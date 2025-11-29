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

    if (customerId) {
        try {
            const existingCustomer = await stripe.customers.retrieve(customerId);
            if (existingCustomer.deleted) customerId = null;
        } catch (e) { customerId = null; }
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

    // --- DEVICE CHECKOUT (INTEGRATED & 16 MONTHS CAP) ---
    if (action === 'create_device_checkout') {
      if (!unitId) throw new Error("Unit ID manquant");

      // 1. Récupérer le prix réel depuis la DB
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

      // 2. Calculs Financiers (16 Mois, 20% Dépôt)
      const price = unit.unit_price;
      const taxRate = 0.14975; // Taxes QC
      const totalWithTax = price * (1 + taxRate);
      
      const upfront = totalWithTax * 0.20; // 20% Dépôt
      const remainder = totalWithTax - upfront;
      const monthly = remainder / 16; // 16 mois

      // 3. Configuration de l'arrêt automatique (16 mois)
      const now = new Date();
      // On ajoute 16 mois et quelques jours de marge pour être sûr que le dernier cycle passe
      const endDate = new Date(now.setMonth(now.getMonth() + 16));
      const cancelAt = Math.floor(endDate.getTime() / 1000);

      // 4. Création de l'Invoice Item pour le Dépôt (Paiement immédiat unique)
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: Math.round(upfront * 100),
        currency: 'cad',
        description: `Dépôt initial (20%) & Activation - ${unit.product.name} (S/N: ${unit.serial_number})`,
      });

      // 5. Création de l'abonnement (Mensualités)
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
            price_data: {
                currency: 'cad',
                product_data: {
                    name: `Financement 16 mois - ${unit.product.name}`,
                    description: `Mensualité pour S/N: ${unit.serial_number}`,
                },
                unit_amount: Math.round(monthly * 100),
                recurring: { interval: 'month' }
            }
        }],
        cancel_at: cancelAt, // ARRÊT AUTOMATIQUE DANS 16 MOIS
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

      // On réserve l'unité
      await serviceClient.from('device_units').update({ status: 'reserved' }).eq('id', unitId);

      // On renvoie le clientSecret pour le Frontend (Elements)
      // @ts-ignore
      const clientSecret = subscription.latest_invoice.payment_intent.client_secret;

      return new Response(
          JSON.stringify({ 
              clientSecret, 
              subscriptionId: subscription.id 
          }), 
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- (Reste du code inchangé pour les abonnements SaaS) ---
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

    if (action === 'create_subscription_intent') {
      const isTrialAllowed = requestedTrial && !profile?.has_used_trial;
      const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: priceId }],
          payment_behavior: 'default_incomplete',
          payment_settings: { save_default_payment_method: 'on_subscription' },
          expand: ['latest_invoice.payment_intent'],
          trial_period_days: isTrialAllowed ? 14 : undefined,
      });
      // @ts-ignore
      const clientSecret = subscription.latest_invoice.payment_intent?.client_secret;
      return new Response(JSON.stringify({ clientSecret, isTrialActive: isTrialAllowed || false }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'create_portal') {
      const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${req.headers.get('origin')}/profile` })
      return new Response(JSON.stringify({ url: session.url }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error(`Action inconnue: ${action}`)

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})