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

    const { action, priceId, isTrial: requestedTrial, unitId } = await req.json()

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

    // Vérification que le customer existe toujours côté Stripe
    if (customerId) {
        try {
            const existingCustomer = await stripe.customers.retrieve(customerId);
            if (existingCustomer.deleted) customerId = null;
        } catch (e) { customerId = null; }
    }

    // Création du customer si inexistant
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

    // ==========================================
    // ACTION 1 : SIVARA BOOK (DEVICE RENTAL)
    // ==========================================
    if (action === 'create_device_checkout') {
      console.log(`[Stripe API] Creating checkout for Unit ID: ${unitId}`);

      if (!unitId) throw new Error("Unit ID manquant dans la requête");

      const serviceClient = createClient(
        // @ts-ignore
        Deno.env.get('SUPABASE_URL') ?? '',
        // @ts-ignore
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: unit, error: dbError } = await serviceClient
        .from('device_units')
        .select(`*, product:device_products (name)`)
        .eq('id', unitId)
        .single();
        
      if (dbError || !unit) throw new Error("Unité introuvable");

      // Calculs Financiers (16 Mois, 20% Dépôt)
      const price = unit.unit_price;
      const taxRate = 0.14975;
      const totalWithTax = price * (1 + taxRate);
      const upfront = totalWithTax * 0.20; 
      const remainder = totalWithTax - upfront;
      const monthly = remainder / 16;

      const now = new Date();
      const endDate = new Date(now.setMonth(now.getMonth() + 16));
      const cancelAt = Math.floor(endDate.getTime() / 1000);

      // @ts-ignore
      const productName = unit.product?.name || 'Sivara Device';

      // Création Produit & Prix Stripe à la volée
      const stripeProduct = await stripe.products.create({
        name: `Abonnement - ${productName}`,
        description: `S/N: ${unit.serial_number}`,
        metadata: { unit_id: unitId, serial_number: unit.serial_number }
      });

      // Invoice Item (Dépôt initial)
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: Math.round(upfront * 100),
        currency: 'cad',
        description: `Dépôt initial - ${productName}`,
      });

      // Abonnement
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
            price_data: {
                currency: 'cad',
                product: stripeProduct.id,
                unit_amount: Math.round(monthly * 100),
                recurring: { interval: 'month' }
            }
        }],
        cancel_at: cancelAt,
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
            type: 'device_rental',
            unit_id: unitId,
            supabase_user_id: user.id,
            real_order: 'true'
        }
      });

      await serviceClient.from('device_units').update({ status: 'reserved' }).eq('id', unitId);

      // @ts-ignore
      const clientSecret = subscription.latest_invoice.payment_intent.client_secret;

      return new Response(JSON.stringify({ clientSecret, subscriptionId: subscription.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==========================================
    // ACTION 2 : SIVARA PRO (ABONNEMENT CLASSIQUE)
    // ==========================================
    if (action === 'create_subscription_intent') {
      // 1. Check Anti-Doublon
      // On cherche les souscriptions existantes pour éviter d'en créer 10 d'un coup
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 5
      });

      // On cherche une souscription "incomplete" (en attente de paiement) ou "active" qui correspondrait à une tentative récente
      const pendingSub = existingSubscriptions.data.find((sub: any) => 
        (sub.status === 'incomplete' || sub.status === 'active' || sub.status === 'trialing') &&
        // On vérifie que ce n'est pas une location d'appareil
        sub.metadata?.type !== 'device_rental'
      );

      // SI TROUVÉ : On recycle !
      if (pendingSub) {
          console.log(`[Stripe API] Abonnement existant trouvé (${pendingSub.id}), réutilisation.`);
          
          // On récupère le clientSecret associé
          let clientSecret;
          const subDetails = await stripe.subscriptions.retrieve(pendingSub.id, {
             expand: ['latest_invoice.payment_intent', 'pending_setup_intent']
          });

          // @ts-ignore
          if (subDetails.pending_setup_intent) {
              // @ts-ignore
              clientSecret = subDetails.pending_setup_intent.client_secret;
          // @ts-ignore
          } else if (subDetails.latest_invoice?.payment_intent) {
              // @ts-ignore
              clientSecret = subDetails.latest_invoice.payment_intent.client_secret;
          }

          if (clientSecret) {
             const isTrial = subDetails.status === 'trialing' || (subDetails.trial_end && subDetails.trial_end > Date.now()/1000);
             return new Response(JSON.stringify({ clientSecret, isTrialActive: isTrial }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
          // Si pas de secret trouvé (cas rare), on continue pour en recréer un
      }

      // 2. Création (Si aucun doublon trouvé)
      const isTrialAllowed = requestedTrial && !profile?.has_used_trial;
      console.log(`[Stripe API] Création nouvel abonnement Pro. Trial allowed: ${isTrialAllowed}`);

      const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: priceId }],
          payment_behavior: 'default_incomplete',
          payment_settings: { save_default_payment_method: 'on_subscription' },
          expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
          trial_period_days: isTrialAllowed ? 14 : undefined,
          metadata: { type: 'pro_subscription' } // Tag pour différencier
      });

      let clientSecret;
      if (isTrialAllowed) {
          // @ts-ignore
          clientSecret = subscription.pending_setup_intent?.client_secret;
      } else {
          // @ts-ignore
          clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;
      }
      
      if (!clientSecret) throw new Error("Impossible de générer le secret de paiement.");

      return new Response(JSON.stringify({ clientSecret, isTrialActive: isTrialAllowed || false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ==========================================
    // ACTION 3 : PORTAIL CLIENT & CONFIG & SYNC
    // ==========================================
    if (action === 'create_portal') {
      const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${req.headers.get('origin')}/profile` })
      return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'get_config') {
        // @ts-ignore
        const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY');
        return new Response(JSON.stringify({ publishableKey }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'sync_subscription') {
        const subscriptions = await stripe.subscriptions.list({ customer: customerId, limit: 1, status: 'all' });
        const sub = subscriptions.data[0];
        let isPro = false, status = 'none', endDate = null;
        if (sub) { status = sub.status; isPro = ['active', 'trialing'].includes(status); endDate = new Date(sub.current_period_end * 1000).toISOString(); }
        
        // @ts-ignore
        const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
        await service.from('profiles').update({ is_pro: isPro, subscription_status: status, subscription_end_date: endDate }).eq('id', user.id);
        return new Response(JSON.stringify({ success: true, isPro }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    throw new Error(`Action inconnue: ${action}`)

  } catch (error: any) {
    console.error("[Stripe API Error]", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})