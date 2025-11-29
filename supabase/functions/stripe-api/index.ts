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

    const { action, priceId, isTrial: requestedTrial, unitId, successUrl, cancelUrl } = await req.json()

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

    // --- DEVICE CHECKOUT (Location Matériel) ---
    if (action === 'create_device_checkout') {
      if (!unitId) throw new Error("Unit ID manquant");

      // 1. Récupérer le prix réel depuis la DB (Sécurité)
      const serviceClient = createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: unit } = await serviceClient
        .from('device_units')
        .select('*, product:product_id(name)')
        .eq('id', unitId)
        .single();
        
      if (!unit) throw new Error("Unité introuvable");

      // 2. Calculs Financiers (Mêmes que frontend)
      const price = unit.unit_price;
      const taxRate = 0.14975; // Taxes QC
      const totalWithTax = price * (1 + taxRate);
      
      const upfront = totalWithTax * 0.20; // 20% Dépôt
      const remainder = totalWithTax - upfront;
      const monthly = remainder / 16; // 16 mois

      // 3. Création Session Stripe
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'cad',
              product_data: {
                name: `Dépôt & Activation - ${unit.product.name}`,
                description: `S/N: ${unit.serial_number} - Dépôt de garantie (20%)`,
                // images: ['https://sivara.ca/public/sivara-book.png'], 
              },
              unit_amount: Math.round(upfront * 100), // En cents
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: 'cad',
              product_data: {
                name: `Abonnement Mensuel - ${unit.product.name}`,
                description: "Engagement 16 mois",
              },
              unit_amount: Math.round(monthly * 100), // En cents
              recurring: {
                interval: 'month',
                interval_count: 1
              }
            },
            quantity: 1,
          }
        ],
        mode: 'subscription',
        success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: {
            type: 'device_rental',
            unit_id: unitId,
            supabase_user_id: user.id
        }
      });

      // On marque l'unité comme 'reserved' temporairement
      await serviceClient.from('device_units').update({ status: 'reserved' }).eq('id', unitId);

      return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- SYNC SUBSCRIPTION (Logiciel) ---
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

    // --- CREATE SUBSCRIPTION INTENT (Logiciel) ---
    if (action === 'create_subscription_intent') {
      if (!priceId) throw new Error("Price ID manquant");

      const isTrialAllowed = requestedTrial && !profile?.has_used_trial && !profile?.is_pro;

      const existingSubs = await stripe.subscriptions.list({
        customer: customerId,
        price: priceId,
        limit: 10,
        status: 'all', 
        expand: ['data.latest_invoice.payment_intent', 'data.pending_setup_intent']
      });

      let subscription;
      const activeOrTrialing = existingSubs.data.find((s: any) => ['active', 'trialing'].includes(s.status));
      const incomplete = existingSubs.data.find((s: any) => s.status === 'incomplete');

      if (activeOrTrialing) {
          subscription = activeOrTrialing;
      } else if (incomplete) {
          subscription = incomplete;
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
      if (subscription.pending_setup_intent) {
        // @ts-ignore
        clientSecret = subscription.pending_setup_intent.client_secret;
      } else if (subscription.latest_invoice?.payment_intent) {
        // @ts-ignore
        clientSecret = subscription.latest_invoice.payment_intent.client_secret;
      } 
      
      return new Response(
        JSON.stringify({ 
          subscriptionId: subscription.id, 
          clientSecret: clientSecret,
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