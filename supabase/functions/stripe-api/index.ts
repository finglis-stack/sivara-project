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
  // Gestion CORS (Preflight)
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log(`[Stripe API] Nouvelle requête reçue`);

    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Vérification Authentification
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    
    if (authError || !user) {
      console.error('[Stripe API] Erreur Auth:', authError);
      throw new Error('Non authentifié');
    }

    const { action, priceId, isTrial: requestedTrial } = await req.json()
    console.log(`[Stripe API] Action: ${action}, User: ${user.id}`);

    // --- ACTION: GET CONFIG (Sans Stripe init) ---
    if (action === 'get_config') {
      // @ts-ignore
      const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY');
      
      console.log(`[Stripe API] Récupération clé publique. Présente ? ${!!publishableKey}`);

      if (!publishableKey) {
        console.error('[Stripe API] STRIPE_PUBLISHABLE_KEY manquante dans les secrets');
        throw new Error('Configuration serveur incomplète (Clé publique manquante)');
      }
      
      return new Response(
        JSON.stringify({ publishableKey }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- INITIALISATION STRIPE (Seulement si nécessaire pour les autres actions) ---
    // @ts-ignore
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
        console.error('[Stripe API] STRIPE_SECRET_KEY manquante');
        throw new Error('Configuration serveur incomplète (Clé secrète manquante)');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const email = user.email

    // --- Gestion Client Stripe & Vérification Profil ---
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, has_used_trial, is_pro')
      .eq('id', user.id)
      .single()

    const isTrialAllowed = requestedTrial && !profile?.has_used_trial && !profile?.is_pro;

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      console.log(`[Stripe API] Création nouveau client Stripe pour ${email}`);
      const customer = await stripe.customers.create({
        email: email,
        metadata: { supabase_uuid: user.id },
      })
      customerId = customer.id
      
      // Update avec service role pour contourner RLS si nécessaire sur l'update
      await createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      ).from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    // --- ACTION: CREATION SOUSCRIPTION ---
    if (action === 'create_subscription_intent') {
      console.log(`[Stripe API] Création intention pour ${customerId}. Essai ? ${isTrialAllowed}`);
      
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
        trial_period_days: isTrialAllowed ? 14 : undefined,
      });

      let clientSecret;
      if (isTrialAllowed && subscription.pending_setup_intent) {
        // @ts-ignore
        clientSecret = subscription.pending_setup_intent.client_secret;
      } else {
        // @ts-ignore
        clientSecret = subscription.latest_invoice.payment_intent.client_secret;
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

    // --- ACTION: PORTAL ---
    if (action === 'create_portal') {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${req.headers.get('origin')}/profile`,
      })
      return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error(`Action inconnue: ${action}`)

  } catch (error) {
    console.error(`[Stripe API Error]`, error)
    return new Response(
      JSON.stringify({ error: error.message || 'Une erreur serveur est survenue' }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})