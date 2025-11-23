// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ==========================================
// 🛡️ TITANIUM TOKENIZER ENGINE (SHARED) 🛡️
// ==========================================
// Doit être STRICTEMENT identique au crawler

class TitaniumTokenizer {
  public static STOPWORDS = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 
    'de', 'du', 'en', 'à', 'dans', 'par', 'pour', 'sur', 'avec', 'sans', 'sous', 'ce', 'se',
    'qui', 'que', 'quoi', 'dont', 'où', 'est', 'sont', 'ont', 'il', 'ils', 'elle', 'elles',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
  ]);

  static normalize(text: string): string {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  static getStem(word: string): string {
    if (word.length <= 4) return word;
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('aux')) return word.slice(0, -2) + 'l'; 
    if (word.endsWith('sse')) return word.slice(0, -3);
    if (word.endsWith('ement')) return word.slice(0, -5);
    if (word.endsWith('ing')) return word.slice(0, -3);
    if (word.endsWith('ed')) return word.slice(0, -2);
    if (word.endsWith('es')) return word.slice(0, -2);
    if (word.endsWith('s')) return word.slice(0, -1);
    if (word.endsWith('er')) return word.slice(0, -2);
    if (word.endsWith('ez')) return word.slice(0, -2);
    if (word.endsWith('ait')) return word.slice(0, -3);
    return word;
  }

  static getPhoneticFingerprint(word: string): string {
    let code = word.toUpperCase();
    code = code.replace(/PH/g, 'F').replace(/CH/g, 'K').replace(/QU/g, 'K').replace(/C([E|I|Y])/g, 'S$1').replace(/C/g, 'K').replace(/GI/g, 'JI').replace(/GE/g, 'JE');
    const firstChar = code.charAt(0);
    const rest = code.slice(1).replace(/[AEIOUHYW]/g, '');
    const cleanRest = rest.replace(/(.)\1+/g, '$1');
    return (firstChar + cleanRest).substring(0, 4);
  }

  static getNGrams(word: string, n: number): string[] {
    if (word.length < n) return [];
    const ngrams = [];
    for (let i = 0; i <= word.length - n; i++) ngrams.push(word.substring(i, i + n));
    return ngrams;
  }
}

// ==========================================
// 🔐 CRYPTO ENGINE
// ==========================================

// @ts-ignore
const encoder = new TextEncoder();
// @ts-ignore
const decoder = new TextDecoder();

class CryptoService {
  private key: CryptoKey | null = null;
  private searchKey: CryptoKey | null = null;

  async initialize(secretKey: string) {
    const keyData = encoder.encode(secretKey.padEnd(32, '0').substring(0, 32));
    this.key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const searchKeyData = await crypto.subtle.digest('SHA-256', keyData);
    this.searchKey = await crypto.subtle.importKey('raw', searchKeyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  }

  async decrypt(encryptedText: string): Promise<string> {
    if (!this.key) throw new Error('Crypto not initialized');
    try {
      const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.key, data);
      return decoder.decode(decrypted);
    } catch (e) { return '[Erreur dechiffrement]'; }
  }

  async generateQueryTokens(query: string): Promise<{ tokens: string[], weights: Map<string, number> }> {
    if (!this.searchKey) throw new Error('Search key not initialized');
    
    const tokens = new Set<string>();
    const weights = new Map<string, number>(); // Map pour stocker l'importance de chaque token
    
    const normalizedText = TitaniumTokenizer.normalize(query);
    const words = normalizedText.split(' ').filter(w => w.length > 1);

    for (const rawWord of words) {
      if (TitaniumTokenizer.STOPWORDS.has(rawWord)) continue;

      // 1. EXACT MATCH (Poids : 100)
      const exactToken = await this.hmacToken(`EX:${rawWord}`);
      tokens.add(exactToken);
      weights.set(exactToken, 100);

      // 2. STEM MATCH (Poids : 80)
      const stem = TitaniumTokenizer.getStem(rawWord);
      if (stem !== rawWord) {
        const stemToken = await this.hmacToken(`ST:${stem}`);
        tokens.add(stemToken);
        weights.set(stemToken, 80);
      }

      // 3. PHONETIC MATCH (Poids : 50)
      const phone = TitaniumTokenizer.getPhoneticFingerprint(rawWord);
      if (phone.length > 1) {
        const phoneToken = await this.hmacToken(`PH:${phone}`);
        tokens.add(phoneToken);
        weights.set(phoneToken, 50);
      }

      // 4. N-GRAMS (Poids : 5 par trigramme)
      if (rawWord.length > 3) {
        const trigrams = TitaniumTokenizer.getNGrams(rawWord, 3);
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

    // 1. Générer les tokens avec poids
    const { tokens: queryTokens, weights } = await cryptoService.generateQueryTokens(query);
    
    if (queryTokens.length === 0) {
       return new Response(JSON.stringify({ results: [], total: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`[TITANIUM SEARCH] Searching with ${queryTokens.length} tokens (Mix of Exact, Stem, Phone, Ngram)`);

    // 2. Recherche SQL "Overlaps"
    // On demande à Postgres de trouver tout ce qui a au moins un point commun
    // L'optimisation GIN rend ça instantané
    const { data: candidates, error, count } = await supabase
      .from('crawled_pages')
      .select('*', { count: 'exact' })
      .overlaps('blind_index', queryTokens)
      .limit(limit * 5); // On récupère plus de candidats pour le ranking en mémoire

    if (error) throw error;

    // 3. Scoring & Ranking en mémoire
    // C'est ici qu'on recrée la pertinence "Google-like"
    const results = [];
    
    for (const page of candidates || []) {
      try {
        const pageTokens = new Set(page.blind_index);
        let score = 0;
        let matchesDetails = { exact: 0, stem: 0, phone: 0, ngram: 0 };

        // Calcul du score pondéré
        queryTokens.forEach(token => {
            if (pageTokens.has(token)) {
                const weight = weights.get(token) || 1;
                score += weight;
                
                // Juste pour le debug/logique
                if (weight === 100) matchesDetails.exact++;
                else if (weight === 80) matchesDetails.stem++;
                else if (weight === 50) matchesDetails.phone++;
                else matchesDetails.ngram++;
            }
        });

        // Seuil de pertinence (Anti-bruit)
        // Si on n'a que des N-Grams faibles (ex: 20 points = 4 trigrammes communs), c'est peut-être du bruit
        // Sauf si la requête est très courte
        if (score < 15) continue;

        // Déchiffrement (seulement si pertinent)
        const decryptedTitle = await cryptoService.decrypt(page.title);
        const decryptedDesc = await cryptoService.decrypt(page.description);
        const decryptedUrl = await cryptoService.decrypt(page.url);
        const decryptedDomain = await cryptoService.decrypt(page.domain);

        // Boost de score si le mot-clé est dans le titre (approximation via longueur)
        // Comme on ne sait pas *où* est le token, on ne peut pas être sûr, 
        // mais on peut booster par défaut les résultats qui matchent "Exact"
        if (matchesDetails.exact > 0) score *= 1.5;

        results.push({
          id: page.id,
          url: decryptedUrl,
          title: decryptedTitle,
          description: decryptedDesc,
          content: "", // Optimisation bande passante
          domain: decryptedDomain,
          crawled_at: page.crawled_at,
          rank: score,
          debug_score: matchesDetails // Pour comprendre pourquoi ça rank
        });
      } catch (e) { continue; }
    }

    // Tri et Pagination manuelle (car on a fetché large)
    results.sort((a, b) => b.rank - a.rank);
    const paginatedResults = results.slice((page - 1) * limit, page * limit);

    return new Response(
      JSON.stringify({
        results: paginatedResults,
        total: count || results.length, // Approximation
        page,
        algorithm: 'Sivara-Titanium-Weighted-SSE',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[SEARCH ERROR]', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})