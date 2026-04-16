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
// @ts-ignore: Deno types
const decoder = new TextDecoder();

class CryptoService {
  private key: CryptoKey | null = null;

  async initialize(secretKey: string) {
    // TODO: SECURITY — padEnd is not a proper KDF. Ideally use SHA-256 or PBKDF2.
    // Kept for backward compatibility with existing encrypted crawler data.
    // ENCRYPTION_KEY should be a high-entropy 32+ char string.
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
    
    try {
      const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        this.key,
        data
      );
      
      return decoder.decode(decrypted);
    } catch (e) {
      throw new Error(`Decryption failed: ${e.message}`);
    }
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
      return new Response(JSON.stringify({ message: 'Crawler paused', processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // --- 2. CONCURRENCY CHECK ---
    const MAX_CONCURRENT_JOBS = 5;
    const { count: processingCount } = await supabase
      .from('crawl_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    if (processingCount !== null && processingCount >= MAX_CONCURRENT_JOBS) {
      return new Response(JSON.stringify({ message: 'Max concurrency reached', processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const availableSlots = MAX_CONCURRENT_JOBS - (processingCount || 0);
    const { batchSize: requestedBatchSize = 5 } = await req.json()
    const effectiveBatchSize = Math.min(requestedBatchSize, availableSlots);

    if (effectiveBatchSize <= 0) {
       return new Response(JSON.stringify({ message: 'No slots available', processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 3. FETCH JOBS
    const { data: queueItems, error: queueError } = await supabase
      .from('crawl_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('added_at', { ascending: true })
      .limit(effectiveBatchSize)

    if (queueError) throw queueError
    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ message: 'No URLs in queue', processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 4. LOCK JOBS
    const ids = queueItems.map((i: any) => i.id)
    await supabase
      .from('crawl_queue')
      .update({ status: 'processing', last_attempt_at: new Date().toISOString() })
      .in('id', ids)

    // 5. PROCESS
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
          await supabase.from('crawl_queue').update({ status: 'completed' }).eq('id', item.id)
          return { id: item.id, status: 'success', skipped: resJson.skipped }
        } else {
          const errorText = await crawlResponse.text();
          throw new Error(`Crawl failed (${crawlResponse.status}): ${errorText}`)
        }
      } catch (error) {
        console.error(`[ERROR] Item ${item.id}:`, error)
        
        // IMPORTANT: On ne supprime plus, on marque comme échoué pour voir l'erreur dans le Monitor
        await supabase.from('crawl_logs').insert({
            queue_id: item.id,
            message: `Fatal error: ${error.message}`,
            step: 'ERROR',
            status: 'error'
        });
        
        await supabase.from('crawl_queue').update({ 
            status: 'failed',
            error_message: error.message 
        }).eq('id', item.id)
        
        return { id: item.id, status: 'failed', error: error.message }
      }
    }))

    // 6. CHAIN
    const { count: remainingPending } = await supabase
      .from('crawl_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (remainingPending && remainingPending > 0) {
      fetch(`${supabaseUrl}/functions/v1/process-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.get('Authorization') || '' },
        body: JSON.stringify({ batchSize: 5 }),
      }).catch(e => console.error("Chain trigger failed", e));
    }

    return new Response(JSON.stringify({ processed: results.length, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})