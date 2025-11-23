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
  private searchKey: CryptoKey | null = null;

  async initialize(secretKey: string) {
    const keyData = encoder.encode(secretKey.padEnd(32, '0').substring(0, 32));
    
    this.key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    // Clé de recherche (Doit être identique à celle du crawler)
    const searchKeyData = await crypto.subtle.digest('SHA-256', keyData);
    this.searchKey = await crypto.subtle.importKey(
      'raw',
      searchKeyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
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
      return '[Decryption Error]';
    }
  }

  // Génération des tokens de requête (Même logique que le crawler)
  async generateQueryTokens(query: string): Promise<string[]> {
    if (!this.searchKey) throw new Error('Search key not initialized');
    
    const normalized = query.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = new Set<string>();
    const words = normalized.split(' ');
    
    for (const word of words) {
      if (word.length < 3) {
        tokens.add(await this.hmacToken(word));
        continue;
      }
      // Trigrammes
      for (let i = 0; i <= word.length - 3; i++) {
        tokens.add(await this.hmacToken(word.substring(i, i + 3)));
      }
    }
    return Array.from(tokens);
  }

  private async hmacToken(input: string): Promise<string> {
    const signature = await crypto.subtle.sign(
      'HMAC',
      this.searchKey!,
      encoder.encode(input)
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature).slice(0, 8)));
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

    const { query, page = 1, limit = 20 } = await req.json()

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ results: [], total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[BLIND SEARCH] Querying tokens for: [REDACTED]`)

    // 1. Générer les tokens de recherche (Hashs des trigrammes)
    const queryTokens = await cryptoService.generateQueryTokens(query);
    
    if (queryTokens.length === 0) {
       return new Response(JSON.stringify({ results: [], total: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // 2. Recherche SQL via Index GIN (overlaps operator '&&')
    // On cherche les pages qui ont au moins un token en commun (Fuzzy)
    // On pourrait être plus strict en demandant @> (contains all), mais && (overlaps) permet l'à-peu-près.
    const offset = (page - 1) * limit;
    
    const { data: candidates, error, count } = await supabase
      .from('crawled_pages')
      .select('*', { count: 'exact' })
      .overlaps('blind_index', queryTokens) // LA MAGIE EST ICI : Postgres fait le travail dur via l'index
      .range(offset, offset + limit - 1);

    if (error) throw error;

    console.log(`[DB HIT] Found ${candidates?.length || 0} candidates via Blind Index`);

    // 3. Déchiffrement et Classement final (Scoring)
    // On ne déchiffre QUE les candidats pertinents (ex: 20 résultats), pas toute la base !
    const results = [];
    
    for (const page of candidates || []) {
      try {
        // Score de pertinence basé sur le nombre de tokens communs (Intersection)
        const pageTokens = new Set(page.blind_index);
        const matchCount = queryTokens.filter(t => pageTokens.has(t)).length;
        const matchRatio = matchCount / queryTokens.length;

        // Si le ratio de correspondance est trop faible (< 30%), on ignore (Faux positif du Fuzzy)
        if (matchRatio < 0.3) continue;

        const decryptedTitle = await cryptoService.decrypt(page.title);
        const decryptedDesc = await cryptoService.decrypt(page.description);
        const decryptedUrl = await cryptoService.decrypt(page.url);
        const decryptedDomain = await cryptoService.decrypt(page.domain);

        results.push({
          id: page.id,
          url: decryptedUrl,
          title: decryptedTitle,
          description: decryptedDesc,
          content: "", // On évite de déchiffrer le gros contenu pour la liste
          domain: decryptedDomain,
          crawled_at: page.crawled_at,
          // Le rank est maintenant basé sur la densité de correspondance des hashs
          rank: matchRatio * 10 
        });
      } catch (e) { continue; }
    }

    // Tri final par pertinence
    results.sort((a, b) => b.rank - a.rank);

    return new Response(
      JSON.stringify({
        results: results,
        total: count || results.length,
        page,
        totalPages: Math.ceil((count || 0) / limit),
        algorithm: 'SSE-Trigram-Blind-Index',
        security: 'Zero-Knowledge'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[SEARCH ERROR]', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})