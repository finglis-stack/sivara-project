// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore: Deno types
import { removeStopwords, fra, eng } from 'https://esm.sh/stopword@3.0.1'

// FIX IMPORTS NATURAL
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
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9\s]/g, " ") // Keep only alphanumeric and spaces
      .replace(/\s+/g, " ").trim();
  }

  static filterStopwords(words: string[]): string[] {
    let cleaned = removeStopwords(words, fra);
    cleaned = removeStopwords(cleaned, eng);
    return cleaned.filter(w => w.length > 1);
  }

  static getStem(word: string): string {
    try {
      return PorterStemmerFr.stem(word);
    } catch (e) {
      console.warn(`[STEMMING] Error stemming "${word}":`, e);
      return word;
    }
  }

  static getPhoneticFingerprint(word: string): string {
    try {
      const code = DoubleMetaphone.process(word);
      // DoubleMetaphone retourne [primary, secondary], on prend le primary
      const primary = code[0];
      // S'assurer qu'on a un code phonétique valide
      if (primary && primary.length > 0) {
        return primary;
      }
      // Fallback: retourner le mot normalisé si pas de code phonétique
      return word.toLowerCase();
    } catch (e) {
      console.warn(`[PHONETIC] Error generating phonetic for "${word}":`, e);
      return word.toLowerCase();
    }
  }

  static getTrigrams(word: string): string[] {
    if (word.length <= 3) return [];
    try {
      return NGrams.trigrams(word).map((t: string[]) => t.join(''));
    } catch (e) {
      console.warn(`[TRIGRAMS] Error generating trigrams for "${word}":`, e);
      return [];
    }
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

  async encrypt(text: string): Promise<string> {
    if (!this.key) throw new Error('Crypto not initialized');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = encoder.encode(text);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
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

  async generateQueryTokens(query: string): Promise<string[]> {
    if (!this.searchKey) throw new Error('Search key not initialized');
    
    const tokens = new Set<string>();
    
    const normalizedText = TitaniumTokenizer.normalize(query);
    const words = normalizedText.split(' ');
    const usefulWords = TitaniumTokenizer.filterStopwords(words);

    console.log(`[TOKEN GENERATION] Input: "${query}"`);
    console.log(`[TOKEN GENERATION] Normalized: "${normalizedText}"`);
    console.log(`[TOKEN GENERATION] Words: ${words.length}, Useful: ${usefulWords.length}`);

    for (const rawWord of usefulWords) {
      // Token exact (match parfait)
      const exactToken = await this.hmacToken(`EX:${rawWord}`);
      tokens.add(exactToken);

      // Token de stemming (racine du mot)
      const stem = TitaniumTokenizer.getStem(rawWord);
      if (stem && stem !== rawWord) {
        const stemToken = await this.hmacToken(`ST:${stem}`);
        tokens.add(stemToken);
      }

      // Token phonétique (recherche par son) - C'EST LE PLUS IMPORTANT
      const phone = TitaniumTokenizer.getPhoneticFingerprint(rawWord);
      if (phone && phone.length > 0) {
        const phoneToken = await this.hmacToken(`PH:${phone}`);
        tokens.add(phoneToken);
        console.log(`[TOKEN GENERATION] Phonetic: "${rawWord}" -> "${phone}"`);
      }

      // Tokens de trigrams (recherche partielle)
      if (rawWord.length > 3) {
        const trigrams = TitaniumTokenizer.getTrigrams(rawWord);
        for (const tri of trigrams) {
            const token = await this.hmacToken(`TG:${tri}`);
            tokens.add(token);
        }
      }
    }

    console.log(`[TOKEN GENERATION] Total tokens generated: ${tokens.size}`);
    return Array.from(tokens);
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

    // Lire le body UNE SEULE FOIS
    const requestBody = await req.json()
    const { action, page = 1, limit = 20, id, url, title, description, domain, searchQuery, gemini_score } = requestBody

    if (action === 'search') {
      // Recherche phonétique dans toutes les pages
      // Utiliser les variables déjà extraites du requestBody
      const searchPage = page || 1;
      const searchLimit = limit || 20;
      
      if (!searchQuery || searchQuery.length < 2) {
        return new Response(
          JSON.stringify({ pages: [], total: 0, page: searchPage, limit: searchLimit, totalPages: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`[SEARCH] Searching for: "${searchQuery}"`)
      
      // Générer les tokens de recherche
      const searchTokens = await cryptoService.generateQueryTokens(searchQuery)
      console.log(`[SEARCH] Generated ${searchTokens.length} search tokens`)

      // Rechercher les pages qui correspondent aux tokens
      const { data: candidates, error, count } = await supabase
        .from('crawled_pages')
        .select('*', { count: 'exact' })
        .overlaps('blind_index', searchTokens)
        .order('crawled_at', { ascending: false })
        .range((searchPage - 1) * searchLimit, searchPage * searchLimit - 1)

      if (error) throw error

      // Décrypter les résultats
      const decryptedPages = await Promise.all((candidates || []).map(async (page: any) => {
        return {
          id: page.id,
          url: await cryptoService.decrypt(page.url),
          title: await cryptoService.decrypt(page.title),
          description: await cryptoService.decrypt(page.description),
          domain: await cryptoService.decrypt(page.domain),
          status: page.status,
          crawled_at: page.crawled_at,
          updated_at: page.updated_at,
          blind_index: page.blind_index,
          gemini_score: page.gemini_score || 0,
        }
      }))

      console.log(`[SEARCH] Found ${decryptedPages.length} results (total: ${count})`)

      return new Response(
        JSON.stringify({ 
          pages: decryptedPages, 
          total: count || 0,
          page: searchPage,
          limit: searchLimit,
          totalPages: Math.ceil((count || 0) / searchLimit)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'list') {
      // Récupérer les pages avec pagination
      const { data, error, count } = await supabase
        .from('crawled_pages')
        .select('*', { count: 'exact' })
        .order('crawled_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1)

      if (error) throw error

      // Décrypter les données
      const decryptedPages = await Promise.all((data || []).map(async (page: any) => {
        return {
          id: page.id,
          url: await cryptoService.decrypt(page.url),
          title: await cryptoService.decrypt(page.title),
          description: await cryptoService.decrypt(page.description),
          domain: await cryptoService.decrypt(page.domain),
          status: page.status,
          crawled_at: page.crawled_at,
          updated_at: page.updated_at,
          blind_index: page.blind_index,
          gemini_score: page.gemini_score || 0,
        }
      }))

      return new Response(
        JSON.stringify({ 
          pages: decryptedPages, 
          total: count || 0,
          page,
          limit,
          totalPages: Math.ceil((count || 0) / limit)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'get') {
      // Récupérer une page spécifique
      const { data, error } = await supabase
        .from('crawled_pages')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      const decryptedPage = {
        id: data.id,
        url: await cryptoService.decrypt(data.url),
        title: await cryptoService.decrypt(data.title),
        description: await cryptoService.decrypt(data.description),
        domain: await cryptoService.decrypt(data.domain),
        status: data.status,
        crawled_at: data.crawled_at,
        updated_at: data.updated_at,
        blind_index: data.blind_index,
        gemini_score: data.gemini_score || 0,
      }

      return new Response(
        JSON.stringify({ page: decryptedPage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'create') {
      console.log('[CREATE] Creating new page with NLP tokens');
      
      // Créer une nouvelle page avec encryption et tokens NLP
      const encryptedUrl = await cryptoService.encrypt(url)
      const encryptedTitle = await cryptoService.encrypt(title || '')
      const encryptedDescription = await cryptoService.encrypt(description || '')
      const encryptedDomain = await cryptoService.encrypt(domain || '')

      // Générer les tokens NLP à partir du contenu complet
      const searchContent = `${title || ''} ${description || ''} ${url}`
      console.log(`[CREATE] Search content: "${searchContent}"`);
      
      const tokens = await cryptoService.generateQueryTokens(searchContent)
      console.log(`[CREATE] Generated ${tokens.length} NLP tokens`);

      const { data, error } = await supabase
        .from('crawled_pages')
        .insert({
          url: encryptedUrl,
          title: encryptedTitle,
          description: encryptedDescription,
          domain: encryptedDomain,
          status: 'success',
          content: '',
          content_vector: null,
          blind_index: tokens,
        })
        .select()
        .single()

      if (error) {
        console.error('[CREATE] Error:', error);
        throw error
      }

      console.log('[CREATE] Page created successfully with ID:', data.id);
      return new Response(
        JSON.stringify({ success: true, page: data, tokensCount: tokens.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update') {
      console.log('[UPDATE] Updating page with ID:', id);
      
      // Mettre à jour une page avec encryption
      const updates: any = {
        updated_at: new Date().toISOString(),
      }

      // Update gemini_score if provided
      if (gemini_score !== undefined) {
        updates.gemini_score = Math.max(0, Math.min(100, parseInt(gemini_score) || 0));
      }

      // Récupérer la page actuelle pour décrypter les valeurs existantes
      const currentPage = await supabase.from('crawled_pages').select('*').eq('id', id).single()
      
      if (!currentPage.data) {
        throw new Error('Page not found');
      }

      // Décrypter les valeurs actuelles
      const currentUrl = await cryptoService.decrypt(currentPage.data.url)
      const currentTitle = await cryptoService.decrypt(currentPage.data.title)
      const currentDescription = await cryptoService.decrypt(currentPage.data.description)
      const currentDomain = await cryptoService.decrypt(currentPage.data.domain)

      // Utiliser les nouvelles valeurs ou garder les anciennes
      const finalUrl = url !== undefined ? url : currentUrl
      const finalTitle = title !== undefined ? title : currentTitle
      const finalDescription = description !== undefined ? description : currentDescription
      const finalDomain = domain !== undefined ? domain : currentDomain

      // Encrypter les nouvelles valeurs
      updates.url = await cryptoService.encrypt(finalUrl)
      updates.title = await cryptoService.encrypt(finalTitle)
      updates.description = await cryptoService.encrypt(finalDescription)
      updates.domain = await cryptoService.encrypt(finalDomain)

      // TOUJOURS régénérer les tokens NLP si le contenu a changé
      const searchContent = `${finalTitle} ${finalDescription} ${finalUrl}`
      console.log(`[UPDATE] Search content: "${searchContent}"`);
      
      const tokens = await cryptoService.generateQueryTokens(searchContent)
      updates.blind_index = tokens
      console.log(`[UPDATE] Regenerated ${tokens.length} NLP tokens`);

      const { data, error } = await supabase
        .from('crawled_pages')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('[UPDATE] Error:', error);
        throw error
      }

      console.log('[UPDATE] Page updated successfully');
      return new Response(
        JSON.stringify({ success: true, page: data, tokensCount: tokens.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'delete') {
      const { error } = await supabase
        .from('crawled_pages')
        .delete()
        .eq('id', id)

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[SEARCH MANAGEMENT ERROR]', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})