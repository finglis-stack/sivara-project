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
    // 1. Initialisation
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

    // 2. Auth Check
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Non authentifié')

    const { action, priceId, isTrial } = await req.json()
    const email = user.email

    // 3. Récupérer ou créer le client Stripe
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
      
      // Sauvegarde immédiate
      await createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      ).from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    // --- ACTION: CHECKOUT (S'abonner) ---
    if (action === 'create_checkout') {
      const sessionConfig: any = {
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${req.headers.get('origin')}/pro-onboarding?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.get('origin')}/pricing`,
        allow_promotion_codes: true,
      }

      // Gestion de l'essai gratuit
      if (isTrial) {
        sessionConfig.subscription_data = {
          trial_period_days: 14,
          metadata: { is_trial: 'true' }
        };
      }

      const session = await stripe.checkout.sessions.create(sessionConfig)
      return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- ACTION: PORTAL (Gérer/Annuler) ---
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