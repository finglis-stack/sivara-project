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

    // --- CIRCUIT BREAKER CHECK ---
    const { data: settings } = await supabase
      .from('crawler_settings')
      .select('is_active')
      .eq('id', 1)
      .single();

    if (settings && settings.is_active === false) {
      console.log('[CIRCUIT BREAKER] Crawler is globally PAUSED. Skipping batch.');
      return new Response(
        JSON.stringify({ message: 'Crawler paused by emergency stop', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    // -----------------------------

    const { batchSize = 3 } = await req.json()

    // 1. Récupérer les items (FIFO : older added_at first)
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

    console.log(`[PROCESS] Processing batch of ${queueItems.length} items concurrently...`)

    // 2. Marquer tout le lot comme "processing"
    const ids = queueItems.map((i: any) => i.id)
    await supabase
      .from('crawl_queue')
      .update({ 
        status: 'processing',
        last_attempt_at: new Date().toISOString(),
      })
      .in('id', ids)

    // 3. Traiter en parallèle
    const results = await Promise.all(queueItems.map(async (item: any) => {
      try {
        const decryptedUrl = await cryptoService.decrypt(item.url)
        
        console.log(`[PROCESS] Calling crawl-page for item ${item.id}`)

        // Appel du crawler (worker)
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
          // Check if it was skipped
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
        
        // SUPPRESSION AUTOMATIQUE SI ERREUR (ex: 500, 404, etc.)
        // On supprime les logs associés d'abord pour éviter les soucis de clé étrangère
        await supabase.from('crawl_logs').delete().eq('queue_id', item.id)
        // On supprime l'élément de la file
        await supabase.from('crawl_queue').delete().eq('id', item.id)
          
        return { id: item.id, status: 'deleted_on_error', error: error.message }
      }
    }))

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