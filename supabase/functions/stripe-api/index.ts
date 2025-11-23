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
      throw new Error('Non authentifié');
    }

    const { action, priceId, isTrial: requestedTrial } = await req.json()

    // --- ACTION: GET CONFIG ---
    if (action === 'get_config') {
      // @ts-ignore
      const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY');
      if (!publishableKey) throw new Error('Clé publique manquante (STRIPE_PUBLISHABLE_KEY)');
      
      return new Response(
        JSON.stringify({ publishableKey }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- INITIALISATION STRIPE ---
    // @ts-ignore
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
        throw new Error('Clé secrète manquante (STRIPE_SECRET_KEY). Vérifiez vos secrets Supabase.');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const email = user.email

    // --- Gestion Client Stripe ---
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id, has_used_trial, is_pro')
      .eq('id', user.id)
      .single()

    const isTrialAllowed = requestedTrial && !profile?.has_used_trial && !profile?.is_pro;
    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email,
        metadata: { supabase_uuid: user.id },
      })
      customerId = customer.id
      
      await createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      ).from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    // --- ACTION: CREATION SOUSCRIPTION ---
    if (action === 'create_subscription_intent') {
      if (!priceId) throw new Error("ID de prix (priceId) manquant");

      try {
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
      } catch (stripeError: any) {
        console.error("Stripe Create Error:", stripeError);
        // Renvoi de l'erreur Stripe spécifique (ex: No such price)
        throw new Error(`Stripe Error: ${stripeError.message}`);
      }
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

  } catch (error: any) {
    console.error(`[API Error]`, error.message)
    // IMPORTANT: On renvoie 200 avec un champ error pour que le client puisse lire le message
    // au lieu de recevoir une erreur générique FunctionsHttpError
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})