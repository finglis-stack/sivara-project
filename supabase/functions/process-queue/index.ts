// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore: Deno types
import { CryptoService } from '../_shared/crypto.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore: Deno types
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // @ts-ignore: Deno types
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-ignore: Deno types
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // @ts-ignore: Deno types
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!
    
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const crypto = new CryptoService()
    await crypto.initialize(encryptionKey)

    const { batchSize = 5 } = await req.json()

    console.log(`[SECURE QUEUE] Processing encrypted queue with batch size: ${batchSize}`)

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
        await supabase
          .from('crawl_queue')
          .update({ 
            status: 'processing',
            last_attempt_at: new Date().toISOString(),
            attempts: item.attempts + 1
          })
          .eq('id', item.id)

        // Décrypter l'URL
        const decryptedUrl = await crypto.decrypt(item.url)
        console.log(`[DECRYPTION] Processing encrypted URL`)

        const crawlResponse = await fetch(`${supabaseUrl}/functions/v1/crawl-page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ url: decryptedUrl, maxDepth: 0 }),
        })

        if (crawlResponse.ok) {
          await supabase
            .from('crawl_queue')
            .delete()
            .eq('id', item.id)

          results.push({ url: '[ENCRYPTED]', status: 'success' })
        } else {
          throw new Error(`Crawl failed with status: ${crawlResponse.status}`)
        }

      } catch (error) {
        console.error(`[ERROR] Processing encrypted item:`, error)
        
        if (item.attempts >= 3) {
          await supabase
            .from('crawl_queue')
            .update({ 
              status: 'failed',
              error_message: error.message
            })
            .eq('id', item.id)
        } else {
          await supabase
            .from('crawl_queue')
            .update({ status: 'pending' })
            .eq('id', item.id)
        }

        results.push({ url: '[ENCRYPTED]', status: 'error', error: error.message })
      }

      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return new Response(
      JSON.stringify({
        message: 'Encrypted queue processed',
        processed: results.length,
        results,
        security: 'Military-grade encryption',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[QUEUE ERROR]', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})