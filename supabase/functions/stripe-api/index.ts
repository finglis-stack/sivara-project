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

    // Récupération du profil
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, has_used_trial, is_pro')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id

    // --- SYNC SUBSCRIPTION ---
    if (action === 'sync_subscription') {
        if (!customerId) throw new Error("Aucun ID client Stripe associé");

        const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            limit: 1,
            status: 'all', 
            expand: ['data.latest_invoice']
        });

        const sub = subscriptions.data[0];
        
        let isPro = false;
        let status = 'none';
        let endDate = null;
        let stripeSubscriptionId = null;
        let hasUsedTrial = profile.has_used_trial; 

        if (sub) {
            stripeSubscriptionId = sub.id;
            status = sub.status;
            isPro = ['active', 'trialing'].includes(status);
            endDate = new Date(sub.current_period_end * 1000).toISOString();

            if (sub.trial_start || sub.trial_end || status === 'trialing') {
                hasUsedTrial = true;
            }
        }

        const serviceClient = createClient(
            // @ts-ignore
            Deno.env.get('SUPABASE_URL') ?? '',
            // @ts-ignore
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

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

    // Gestion Client Inconnu
    if (customerId) {
        try {
            const existingCustomer = await stripe.customers.retrieve(customerId);
            if (existingCustomer.deleted) customerId = null;
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

    // --- SUBSCRIPTION INTENT (CORRECTION ICI) ---
    if (action === 'create_subscription_intent') {
      if (!priceId) throw new Error("Price ID manquant");

      const isTrialAllowed = requestedTrial && !profile?.has_used_trial && !profile?.is_pro;

      // FIX: On cherche TOUS les statuts, pas juste incomplete
      // Cela évite de recréer un abonnement si l'utilisateur est déjà en trialing ou active
      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        price: priceId,
        limit: 10, // Marge de sécurité
        status: 'all', 
        expand: ['data.latest_invoice.payment_intent', 'data.pending_setup_intent']
      });

      let subscription;

      // 1. Priorité aux abonnements déjà actifs ou en essai (pour ne pas dupliquer)
      const activeOrTrialing = existingSubs.data.find((s: any) => ['active', 'trialing'].includes(s.status));
      
      // 2. Sinon, on cherche un incomplet (panier abandonné)
      const incomplete = existingSubs.data.find((s: any) => s.status === 'incomplete');

      if (activeOrTrialing) {
          subscription = activeOrTrialing;
      } else if (incomplete) {
          subscription = incomplete;
      } else {
          // 3. Rien n'existe, on crée
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
      
      // Logique de récupération du secret un peu plus robuste
      if (subscription.pending_setup_intent) {
        // @ts-ignore
        clientSecret = subscription.pending_setup_intent.client_secret;
      } else if (subscription.latest_invoice?.payment_intent) {
        // @ts-ignore
        clientSecret = subscription.latest_invoice.payment_intent.client_secret;
      } 
      
      // Si l'abonnement est déjà actif/payé, il n'y a peut-être pas de secret nécessaire
      // Le frontend devra gérer le cas où clientSecret est null si l'utilisateur recharge la page Checkout alors qu'il est déjà pro
      
      return new Response(
        JSON.stringify({ 
          subscriptionId: subscription.id, 
          clientSecret: clientSecret,
          // Si on a récupéré un abo existant qui est déjà en trialing, on renvoie true
          isTrialActive: isTrialAllowed || subscription.status === 'trialing'
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