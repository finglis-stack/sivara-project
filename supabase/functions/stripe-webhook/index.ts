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
// @ts-ignore
const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature || !endpointSecret) return new Response('Webhook Error', { status: 400 })

  try {
    const body = await req.text()
    const event = stripe.webhooks.constructEvent(body, signature, endpointSecret)
    
    const supabase = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Gestion des événements
    switch (event.type) {
      // Abonnement créé ou mis à jour (Essai, Renouvellement, Annulation programmée)
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        
        // Trouver l'utilisateur via stripe_customer_id
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', subscription.customer)
          .single()

        if (profile) {
           const status = subscription.status // active, trialing, canceled, past_due
           const isPro = status === 'active' || status === 'trialing'
           const endDate = new Date(subscription.current_period_end * 1000).toISOString()
           const hasUsedTrial = subscription.status === 'trialing' || subscription.status === 'active'

           await supabase.from('profiles').update({
             is_pro: isPro,
             subscription_status: status,
             subscription_end_date: endDate,
             stripe_subscription_id: subscription.id,
             // On ne remet jamais has_used_trial à false une fois qu'il est true
             ...(hasUsedTrial ? { has_used_trial: true } : {})
           }).eq('id', profile.id)
        }
        break
      }

      // Abonnement supprimé immédiatement
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        await supabase.from('profiles').update({
             is_pro: false,
             subscription_status: 'canceled',
             subscription_end_date: null,
        }).eq('stripe_customer_id', subscription.customer)
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })

  } catch (err) {
    console.error(`Webhook Error: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})