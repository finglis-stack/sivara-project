// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore: Deno types
const encoder = new TextEncoder();
const decoder = new TextDecoder();

class CryptoService {
  private key: CryptoKey | null = null;

  async initialize(secretKey: string) {
    const keyData = encoder.encode(secretKey.padEnd(32, '0').substring(0, 32));
    this.key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async decrypt(encryptedText: string): Promise<string> {
    if (!this.key) throw new Error('Crypto not initialized');
    
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.key,
      data
    );
    
    return decoder.decode(decrypted);
  }
}

// @ts-ignore: Deno types
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // @ts-ignore
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const cryptoService = new CryptoService()
    await cryptoService.initialize(encryptionKey)

    // --- 1. GLOBAL PAUSE CHECK ---
    const { data: settings } = await supabase
      .from('crawler_settings')
      .select('is_active')
      .eq('id', 1)
      .single();

    if (settings && settings.is_active === false) {
      return new Response(
        JSON.stringify({ message: 'Crawler paused', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- 2. CONCURRENCY LIMIT CHECK ---
    const { count: processingCount, error: countError } = await supabase
      .from('crawl_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');
      
    const MAX_CONCURRENT_JOBS = 3;

    if (countError) throw countError;

    if (processingCount !== null && processingCount >= MAX_CONCURRENT_JOBS) {
      console.log(`[LIMIT] Max concurrency reached (${processingCount}/${MAX_CONCURRENT_JOBS}). Skipping batch.`);
      return new Response(
        JSON.stringify({ message: 'Max concurrency reached', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const availableSlots = MAX_CONCURRENT_JOBS - (processingCount || 0);
    const { batchSize: requestedBatchSize = 3 } = await req.json()
    const effectiveBatchSize = Math.min(requestedBatchSize, availableSlots);

    if (effectiveBatchSize <= 0) {
       return new Response(
        JSON.stringify({ message: 'No slots available', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Récupérer les items (FIFO)
    const { data: queueItems, error: queueError } = await supabase
      .from('crawl_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('added_at', { ascending: true })
      .limit(effectiveBatchSize)

    if (queueError) throw queueError

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No URLs in queue', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[PROCESS] Processing batch of ${queueItems.length} items...`)

    // 4. Marquer comme "processing"
    const ids = queueItems.map((i: any) => i.id)
    await supabase
      .from('crawl_queue')
      .update({ 
        status: 'processing',
        last_attempt_at: new Date().toISOString(),
      })
      .in('id', ids)

    // 5. Traiter
    const results = await Promise.all(queueItems.map(async (item: any) => {
      try {
        const decryptedUrl = await cryptoService.decrypt(item.url)
        
        const crawlResponse = await fetch(`${supabaseUrl}/functions/v1/crawl-page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ 
            url: decryptedUrl, 
            maxDepth: 0,
            queueId: item.id 
          }),
        })

        if (crawlResponse.ok) {
          const resJson = await crawlResponse.json().catch(() => ({}));
          await supabase
            .from('crawl_queue')
            .update({ status: 'completed' })
            .eq('id', item.id)
          return { id: item.id, status: 'success', skipped: resJson.skipped }
        } else {
          throw new Error(`Crawl status: ${crawlResponse.status}`)
        }
      } catch (error) {
        console.error(`[ERROR] Item ${item.id}:`, error)
        await supabase.from('crawl_logs').delete().eq('queue_id', item.id)
        await supabase.from('crawl_queue').delete().eq('id', item.id)
        return { id: item.id, status: 'deleted_on_error', error: error.message }
      }
    }))

    // --- 6. CHAIN REACTION (NEW) ---
    // Vérifier s'il reste des items en attente
    const { count: remainingPending } = await supabase
      .from('crawl_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (remainingPending && remainingPending > 0) {
      console.log(`[CHAIN] ${remainingPending} items remaining. Triggering next batch...`);
      
      // Appel asynchrone (Fire and Forget) pour ne pas bloquer la réponse actuelle
      fetch(`${supabaseUrl}/functions/v1/process-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization') || '',
        },
        body: JSON.stringify({ batchSize: 3 }),
      }).catch(e => console.error("Chain trigger failed", e));
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})