// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore: Deno types
import Stripe from 'https://esm.sh/stripe@13.6.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      throw new Error('Non authentifié');
    }

    const { action, priceId, isTrial: requestedTrial } = await req.json()

    // --- CONFIG ---
    if (action === 'get_config') {
      // @ts-ignore
      const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY');
      return new Response(JSON.stringify({ publishableKey }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- STRIPE INIT ---
    // @ts-ignore
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('Clé secrète manquante');

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Récupération du profil (commun à plusieurs actions)
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, has_used_trial, is_pro')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    // --- SYNC SUBSCRIPTION (SOURCE DE VÉRITÉ = STRIPE) ---
    if (action === 'sync_subscription') {
        if (!customerId) throw new Error("Aucun ID client Stripe associé");

        // On récupère l'abonnement le plus récent, quel que soit son statut
        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            limit: 1,
            status: 'all', // Important: on veut voir même les annulés ou impayés
            expand: ['data.latest_invoice']
        });

        const sub = subscriptions.data[0];
        
        // Valeurs par défaut (si aucun abo trouvé)
        let isPro = false;
        let status = 'none';
        let endDate = null;
        let stripeSubscriptionId = null;
        // On garde la valeur DB par défaut, car Stripe ne garde pas l'historique "a eu un essai" sur l'objet Customer facilement
        // Sauf si l'abonnement actuel prouve le contraire
        let hasUsedTrial = profile.has_used_trial; 

        if (sub) {
            stripeSubscriptionId = sub.id;
            status = sub.status;
            
            // Logique stricte : Actif seulement si active ou trialing
            // Note: 'past_due' n'est PAS pro (paiement échoué)
            isPro = ['active', 'trialing'].includes(status);
            
            // DATE DE FIN : Source unique = Stripe current_period_end
            endDate = new Date(sub.current_period_end * 1000).toISOString();

            // LOGIQUE ESSAI : Si l'abonnement Stripe a des dates d'essai, c'est que l'essai est consommé/en cours
            if (sub.trial_start || sub.trial_end) {
                hasUsedTrial = true;
            }
            // Si le statut est directement 'trialing', c'est évident
            if (status === 'trialing') {
                hasUsedTrial = true;
            }
        }

        // Mise à jour forcée via Service Role (contourne RLS)
        const serviceClient = createClient(
            // @ts-ignore
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // On écrase la DB avec les infos Stripe
        await serviceClient.from('profiles').update({
            is_pro: isPro,
            subscription_status: status,
            subscription_end_date: endDate,
            has_used_trial: hasUsedTrial,
            stripe_subscription_id: stripeSubscriptionId
        }).eq('id', user.id);

        return new Response(
            JSON.stringify({ success: true, isPro, status, endDate }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Gestion Client Inconnu (Réparation auto pour les autres actions)
    if (customerId) {
        try {
            const existingCustomer = await stripe.customers.retrieve(customerId);
            if (existingCustomer.deleted) {
                customerId = null;
            }
        } catch (e) {
            customerId = null;
        }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_uuid: user.id },
      })
      customerId = customer.id
      
      const serviceClient = createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      await serviceClient.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    // --- SUBSCRIPTION INTENT ---
    if (action === 'create_subscription_intent') {
      if (!priceId) throw new Error("Price ID manquant");

      // Double vérification stricte pour l'essai
      const isTrialAllowed = requestedTrial && !profile?.has_used_trial && !profile?.is_pro;

      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'incomplete',
        limit: 1,
        price: priceId,
        expand: ['data.latest_invoice.payment_intent', 'data.pending_setup_intent']
      });

      let subscription;
      
      if (existingSubs.data.length > 0) {
        subscription = existingSubs.data[0];
      } else {
        subscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [{ price: priceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: { save_default_payment_method: 'on_subscription' },
            expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
            trial_period_days: isTrialAllowed ? 14 : undefined,
        });
      }

      let clientSecret;
      if (isTrialAllowed && subscription.pending_setup_intent) {
        // @ts-ignore
        clientSecret = subscription.pending_setup_intent.client_secret;
      } else if (subscription.latest_invoice?.payment_intent) {
        // @ts-ignore
        clientSecret = subscription.latest_invoice.payment_intent.client_secret;
      } else {
        throw new Error("Impossible de récupérer le secret de paiement.");
      }

      return new Response(
        JSON.stringify({ 
          subscriptionId: subscription.id, 
          clientSecret: clientSecret,
          isTrialActive: isTrialAllowed 
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- PORTAL ---
    if (action === 'create_portal') {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${req.headers.get('origin')}/profile`,
      })
      return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error(`Action inconnue: ${action}`)

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})