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
    const cryptoService = new CryptoService()
    await cryptoService.initialize(encryptionKey)

    const { query, page = 1, limit = 10 } = await req.json()

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Search query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[SECURE SEARCH] Searching encrypted database for: [REDACTED]`)

    // Récupérer toutes les pages cryptées
    const { data: encryptedPages, error } = await supabase
      .from('crawled_pages')
      .select('*')
      .eq('status', 'success')
      .limit(500)

    if (error) {
      console.error('[SEARCH ERROR]', error)
      throw error
    }

    console.log(`[DECRYPTION] Decrypting ${encryptedPages?.length || 0} pages for search...`)

    const results = []
    const queryLower = query.toLowerCase()

    // Décrypter et rechercher
    for (const page of encryptedPages || []) {
      try {
        const decryptedTitle = await cryptoService.decrypt(page.title)
        const decryptedDescription = await cryptoService.decrypt(page.description)
        const decryptedContent = await cryptoService.decrypt(page.content)
        const decryptedUrl = await cryptoService.decrypt(page.url)
        const decryptedDomain = await cryptoService.decrypt(page.domain)

        const searchText = `${decryptedTitle} ${decryptedDescription} ${decryptedContent}`.toLowerCase()
        
        if (searchText.includes(queryLower)) {
          const rank = (decryptedTitle.toLowerCase().includes(queryLower) ? 10 : 0) +
                      (decryptedDescription.toLowerCase().includes(queryLower) ? 5 : 0) +
                      (decryptedContent.toLowerCase().includes(queryLower) ? 1 : 0)

          results.push({
            id: page.id,
            url: decryptedUrl,
            title: decryptedTitle,
            description: decryptedDescription,
            content: decryptedContent.substring(0, 300),
            domain: decryptedDomain,
            crawled_at: page.crawled_at,
            rank: rank,
          })
        }
      } catch (decryptError) {
        console.error('[DECRYPTION ERROR]', decryptError)
        continue
      }
    }

    // Trier par pertinence
    results.sort((a, b) => b.rank - a.rank)

    const offset = (page - 1) * limit
    const paginatedResults = results.slice(offset, offset + limit)

    console.log(`[SUCCESS] Found ${results.length} results (showing ${paginatedResults.length})`)

    return new Response(
      JSON.stringify({
        results: paginatedResults,
        total: results.length,
        page,
        totalPages: Math.ceil(results.length / limit),
        encryption: 'AES-256-GCM',
        security: 'Military-grade',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[SEARCH ERROR]', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message,
        results: [],
        total: 0
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})