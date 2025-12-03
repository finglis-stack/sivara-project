// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore: Deno types
import Stripe from 'https://esm.sh/stripe@13.6.0'

// @ts-ignore
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  // @ts-ignore
  const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const signature = req.headers.get('stripe-signature')

  if (!signature || !endpointSecret) {
    console.error('[Webhook] Manque la signature ou le secret')
    return new Response('Webhook Error: Configuration manquante', { status: 400 })
  }

  try {
    const body = await req.text()
    let event;

    try {
        event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret)
    } catch (err: any) {
        console.error(`[Webhook] Erreur de signature: ${err.message}`)
        return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }
    
    console.log(`[Webhook] Événement reçu: ${event.type}`)

    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Gestion des événements
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const status = subscription.status // active, trialing, canceled, past_due
        
        // --- 1. GESTION DES APPAREILS (DEVICE RENTAL) ---
        // Prioritaire et indépendant du mapping profil/stripe_id
        if (subscription.metadata?.type === 'device_rental') {
            const unitId = subscription.metadata.unit_id;
            const userId = subscription.metadata.supabase_user_id;

            console.log(`[Webhook] Traitement Device Rental. Unit: ${unitId}, User: ${userId}, Status: ${status}`);

            if (unitId && userId && status === 'active') {
                // Attribution définitive
                const { error: deviceError } = await supabase.from('device_units').update({ 
                    status: 'sold',
                    sold_to_user_id: userId,
                    reserved_at: null 
                }).eq('id', unitId);

                if (deviceError) console.error("[Webhook] Erreur update device:", deviceError);
                else console.log(`[Webhook] SUCCÈS: Device ${unitId} attribué à ${userId}`);

            } else if (unitId && (status === 'canceled' || status === 'unpaid' || status === 'past_due')) {
                // Libération si échec paiement
                await supabase.from('device_units').update({ 
                    status: 'available',
                    sold_to_user_id: null,
                    reserved_at: null
                }).eq('id', unitId);
                console.log(`[Webhook] Device ${unitId} libéré (Paiement échoué/Annulé)`);
            }
        }

        // --- 2. GESTION DU STATUT PRO ---
        // Nécessite de trouver le profil via stripe_customer_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', subscription.customer)
          .single()

        if (profile) {
           const isPro = status === 'active' || status === 'trialing'
           const endDate = new Date(subscription.current_period_end * 1000).toISOString()
           const hasUsedTrial = subscription.status === 'trialing' || subscription.status === 'active'

           // On ne met à jour le statut PRO que si ce n'est PAS une location d'appareil seule
           // (Sauf si l'abonnement device inclut le statut Pro, ce qui est généralement le cas)
           // Ici on assume que tout abonnement actif donne le statut pro/client actif
           
           await supabase.from('profiles').update({
             is_pro: isPro,
             subscription_status: status,
             subscription_end_date: endDate,
             stripe_subscription_id: subscription.id,
             ...(hasUsedTrial ? { has_used_trial: true } : {})
           }).eq('id', profile.id)
           
           console.log(`[Webhook] Profil ${profile.id} mis à jour: ${status}`)
        } else {
           console.warn(`[Webhook] Aucun profil trouvé pour le client Stripe: ${subscription.customer} (Normal pour Device Rental si premier achat)`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        
        if (subscription.metadata?.type === 'device_rental') {
             const unitId = subscription.metadata.unit_id;
             if (unitId) {
                 await supabase.from('device_units').update({ 
                     status: 'available',
                     sold_to_user_id: null,
                     reserved_at: null
                 }).eq('id', unitId);
                 console.log(`[Webhook] Device ${unitId} libéré (Subscription deleted)`);
             }
        }
        
        // Mise à jour profil si trouvé
        const { data: profile } = await supabase.from('profiles').select('id').eq('stripe_customer_id', subscription.customer).single();
        if (profile) {
             await supabase.from('profiles').update({
                  is_pro: false,
                  subscription_status: 'canceled',
                  subscription_end_date: null,
             }).eq('id', profile.id)
        }
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (err: any) {
    console.error(`[Webhook] Erreur serveur: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})