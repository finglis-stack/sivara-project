// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore: Deno types
import { removeStopwords, fra, eng } from 'https://esm.sh/stopword@3.0.1'

// --- FIX IMPORTS NATURAL (Default Exports pour compatibilité Edge) ---
// @ts-ignore: Deno types
import PorterStemmerFr from 'https://esm.sh/natural@6.10.4/lib/natural/stemmers/porter_stemmer_fr.js'
// @ts-ignore: Deno types
import DoubleMetaphone from 'https://esm.sh/natural@6.10.4/lib/natural/phonetics/double_metaphone.js'
// @ts-ignore: Deno types
import NGrams from 'https://esm.sh/natural@6.10.4/lib/natural/ngrams/ngrams.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

class TitaniumTokenizer {
  
  static normalize(text: string): string {
    return text.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-z0-9\s]/g, " ") 
      .replace(/\s+/g, " ").trim();
  }

  static filterStopwords(words: string[]): string[] {
    let cleaned = removeStopwords(words, fra);
    cleaned = removeStopwords(cleaned, eng);
    return cleaned.filter(w => w.length > 1);
  }

  static getStem(word: string): string {
    // PorterStemmerFr est souvent exporté directement
    return PorterStemmerFr.stem(word);
  }

  static getPhoneticFingerprint(word: string): string {
    // DoubleMetaphone.process renvoie [primary, secondary]
    const code = DoubleMetaphone.process(word);
    return code[0]; 
  }

  static getTrigrams(word: string): string[] {
    if (word.length <= 3) return [];
    // NGrams est l'objet exporté contenant la méthode trigrams
    return NGrams.trigrams(word).map((t: string[]) => t.join(''));
  }
}

// @ts-ignore
const encoder = new TextEncoder();
// @ts-ignore
const decoder = new TextDecoder();

class CryptoService {
  private key: CryptoKey | null = null;
  private searchKey: CryptoKey | null = null;

  async initialize(secretKey: string) {
    // SECURITY: Proper KDF via PBKDF2 (100k iterations, SHA-512)
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(secretKey), 'PBKDF2', false, ['deriveBits', 'deriveKey']
    );
    this.key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: encoder.encode('sivara-crawler-aes-v2'), iterations: 100000, hash: 'SHA-512' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    const searchBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: encoder.encode('sivara-crawler-hmac-v2'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    this.searchKey = await crypto.subtle.importKey('raw', searchBits, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  }

  async decrypt(encryptedText: string): Promise<string> {
    if (!this.key) throw new Error('Crypto not initialized');
    try {
      const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.key, data);
      return decoder.decode(decrypted);
    } catch (e) {
      // SECURITY: Log and propagate decrypt errors — don't return magic strings
      console.error('[DECRYPT_ERROR]', e instanceof Error ? e.message : 'Unknown');
      throw new Error('Decryption failed');
    }
  }

  async generateQueryTokens(query: string): Promise<{ tokens: string[], weights: Map<string, number> }> {
    if (!this.searchKey) throw new Error('Search key not initialized');
    
    const tokens = new Set<string>();
    const weights = new Map<string, number>();
    
    const normalizedText = TitaniumTokenizer.normalize(query);
    const words = normalizedText.split(' ');
    const usefulWords = TitaniumTokenizer.filterStopwords(words);

    for (const rawWord of usefulWords) {
      const exactToken = await this.hmacToken(`EX:${rawWord}`);
      tokens.add(exactToken);
      weights.set(exactToken, 100);

      const stem = TitaniumTokenizer.getStem(rawWord);
      if (stem && stem !== rawWord) {
        const stemToken = await this.hmacToken(`ST:${stem}`);
        tokens.add(stemToken);
        weights.set(stemToken, 80);
      }

      const phone = TitaniumTokenizer.getPhoneticFingerprint(rawWord);
      if (phone && phone.length > 0) {
        const phoneToken = await this.hmacToken(`PH:${phone}`);
        tokens.add(phoneToken);
        weights.set(phoneToken, 50);
      }

      if (rawWord.length > 3) {
        const trigrams = TitaniumTokenizer.getTrigrams(rawWord);
        for (const tri of trigrams) {
            const token = await this.hmacToken(`TG:${tri}`);
            tokens.add(token);
            weights.set(token, 5);
        }
      }
    }

    return { tokens: Array.from(tokens), weights };
  }

  private async hmacToken(input: string): Promise<string> {
    const signature = await crypto.subtle.sign('HMAC', this.searchKey!, encoder.encode(input));
    return btoa(String.fromCharCode(...new Uint8Array(signature).slice(0, 8)));
  }
}

// @ts-ignore
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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
      return new Response(JSON.stringify({ results: [], total: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { tokens: queryTokens, weights } = await cryptoService.generateQueryTokens(query);
    
    if (queryTokens.length === 0) {
       return new Response(JSON.stringify({ results: [], total: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`[TITANIUM PRO] Searching with ${queryTokens.length} tokens`);

    const { data: candidates, error, count } = await supabase
      .from('crawled_pages')
      .select('*', { count: 'exact' })
      .overlaps('blind_index', queryTokens)
      .limit(limit * 5); 

    if (error) throw error;

    const results = [];
    
    for (const page of candidates || []) {
      try {
        const pageTokens = new Set(page.blind_index);
        let score = 0;
        let matchesDetails = { exact: 0, stem: 0, phone: 0, ngram: 0 };

        queryTokens.forEach(token => {
            if (pageTokens.has(token)) {
                const weight = weights.get(token) || 1;
                score += weight;
                if (weight === 100) matchesDetails.exact++;
                else if (weight === 80) matchesDetails.stem++;
                else if (weight === 50) matchesDetails.phone++;
                else matchesDetails.ngram++;
            }
        });

        if (score < 15) continue;

        const decryptedTitle = await cryptoService.decrypt(page.title);
        const decryptedDesc = await cryptoService.decrypt(page.description);
        const decryptedUrl = await cryptoService.decrypt(page.url);
        const decryptedDomain = await cryptoService.decrypt(page.domain);

        if (matchesDetails.exact > 0) score *= 1.5;

        // Gemini AI boost: gemini_score (0-100) adds a multiplier from 1.0 to 2.0
        const geminiScore = page.gemini_score || 0;
        const geminiMultiplier = 1 + (geminiScore / 100);
        score = Math.round(score * geminiMultiplier);

        results.push({
          id: page.id,
          url: decryptedUrl,
          title: decryptedTitle,
          description: decryptedDesc,
          content: "", 
          domain: decryptedDomain,
          crawled_at: page.crawled_at,
          rank: score,
          debug_score: matchesDetails 
        });
      } catch (e) { continue; }
    }

    results.sort((a, b) => b.rank - a.rank);
    const paginatedResults = results.slice((page - 1) * limit, page * limit);

    return new Response(
      JSON.stringify({
        results: paginatedResults,
        total: count || results.length,
        page,
        algorithm: 'Sivara-Titanium-Gemini',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[SEARCH ERROR]', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})