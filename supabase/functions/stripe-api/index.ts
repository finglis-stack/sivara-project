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

    // @ts-ignore
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    const { action, priceId, isTrial } = await req.json()
    const email = user.email

    // --- Gestion Client Stripe ---
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

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

    // --- ACTION: CREATION SOUSCRIPTION (EMBEDDED) ---
    if (action === 'create_subscription_intent') {
      
      // On crée la souscription immédiatement mais en mode "incomplet"
      // Cela permet au frontend de finaliser le paiement ou l'empreinte CB
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
        trial_period_days: isTrial ? 14 : undefined,
      });

      // Si c'est un essai gratuit, on utilise le pending_setup_intent (empreinte CB)
      // Sinon, on utilise le payment_intent de la facture (paiement immédiat)
      let clientSecret;
      if (isTrial && subscription.pending_setup_intent) {
        // @ts-ignore
        clientSecret = subscription.pending_setup_intent.client_secret;
      } else {
        // @ts-ignore
        clientSecret = subscription.latest_invoice.payment_intent.client_secret;
      }

      return new Response(
        JSON.stringify({ 
          subscriptionId: subscription.id, 
          clientSecret: clientSecret 
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

    throw new Error('Action inconnue')

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})