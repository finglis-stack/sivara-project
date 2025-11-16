import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { batchSize = 5 } = await req.json()

    console.log(`Processing queue with batch size: ${batchSize}`)

    // Récupérer les URLs en attente
    const { data: queueItems, error: queueError } = await supabase
      .from('crawl_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('added_at', { ascending: true })
      .limit(batchSize)

    if (queueError) throw queueError

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No URLs in queue', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = []

    for (const item of queueItems) {
      try {
        // Marquer comme en cours de traitement
        await supabase
          .from('crawl_queue')
          .update({ 
            status: 'processing',
            last_attempt_at: new Date().toISOString(),
            attempts: item.attempts + 1
          })
          .eq('id', item.id)

        // Appeler la fonction de crawl
        const crawlResponse = await fetch(`${supabaseUrl}/functions/v1/crawl-page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ url: item.url, maxDepth: 0 }),
        })

        if (crawlResponse.ok) {
          // Supprimer de la queue si succès
          await supabase
            .from('crawl_queue')
            .delete()
            .eq('id', item.id)

          results.push({ url: item.url, status: 'success' })
        } else {
          throw new Error(`Crawl failed with status: ${crawlResponse.status}`)
        }

      } catch (error) {
        console.error(`Error processing ${item.url}:`, error)
        
        // Marquer comme échoué si trop de tentatives
        if (item.attempts >= 3) {
          await supabase
            .from('crawl_queue')
            .update({ 
              status: 'failed',
              error_message: error.message
            })
            .eq('id', item.id)
        } else {
          // Remettre en attente pour réessayer
          await supabase
            .from('crawl_queue')
            .update({ status: 'pending' })
            .eq('id', item.id)
        }

        results.push({ url: item.url, status: 'error', error: error.message })
      }

      // Petit délai entre chaque crawl pour être respectueux
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return new Response(
      JSON.stringify({
        message: 'Queue processed',
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Queue processing error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})