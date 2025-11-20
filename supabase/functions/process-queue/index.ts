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

    const { batchSize = 5 } = await req.json()

    // On prend les items pending
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
        const decryptedUrl = await cryptoService.decrypt(item.url)
        
        // On appelle le crawler en lui passant l'ID de la queue pour le logging
        const crawlResponse = await fetch(`${supabaseUrl}/functions/v1/crawl-page`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ 
            url: decryptedUrl, 
            maxDepth: 0,
            queueId: item.id // IMPORTANT: On passe l'ID pour les logs
          }),
        })

        if (crawlResponse.ok) {
          await supabase
            .from('crawl_queue')
            .update({ status: 'completed' }) // On marque comme completed au lieu de supprimer pour garder l'historique des logs
            .eq('id', item.id)

          results.push({ id: item.id, status: 'success' })
        } else {
          throw new Error(`Crawl failed with status: ${crawlResponse.status}`)
        }

      } catch (error) {
        console.error(`[ERROR] Processing encrypted item:`, error)
        
        await supabase
          .from('crawl_queue')
          .update({ 
            status: 'failed',
            error_message: error.message
          })
          .eq('id', item.id)

        results.push({ id: item.id, status: 'error', error: error.message })
      }
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