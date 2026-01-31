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
    return PorterStemmerFr.stem(word);
  }

  static getPhoneticFingerprint(word: string): string {
    const code = DoubleMetaphone.process(word);
    return code[0]; 
  }

  static getTrigrams(word: string): string[] {
    if (word.length <= 3) return [];
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
    const keyData = encoder.encode(secretKey.padEnd(32, '0').substring(0, 32));
    this.key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const searchKeyData = await crypto.subtle.digest('SHA-256', keyData);
    this.searchKey = await crypto.subtle.importKey('raw', searchKeyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
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
      console.error('Decryption error:', e);
      return '[Erreur dechiffrement]'; 
    }
  }

  async generateQueryTokens(query: string): Promise<string[]> {
    if (!this.searchKey) throw new Error('Search key not initialized');
    
    const tokens = new Set<string>();
    
    const normalizedText = TitaniumTokenizer.normalize(query);
    const words = normalizedText.split(' ');
    const usefulWords = TitaniumTokenizer.filterStopwords(words);

    for (const rawWord of usefulWords) {
      const exactToken = await this.hmacToken(`EX:${rawWord}`);
      tokens.add(exactToken);

      const stem = TitaniumTokenizer.getStem(rawWord);
      if (stem && stem !== rawWord) {
        const stemToken = await this.hmacToken(`ST:${stem}`);
        tokens.add(stemToken);
      }

      const phone = TitaniumTokenizer.getPhoneticFingerprint(rawWord);
      if (phone && phone.length > 0) {
        const phoneToken = await this.hmacToken(`PH:${phone}`);
        tokens.add(phoneToken);
      }

      if (rawWord.length > 3) {
        const trigrams = TitaniumTokenizer.getTrigrams(rawWord);
        for (const tri of trigrams) {
            const token = await this.hmacToken(`TG:${tri}`);
            tokens.add(token);
        }
      }
    }

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

    const { action, page = 1, limit = 20, id, url, title, description, domain } = await req.json()

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
      }

      return new Response(
        JSON.stringify({ page: decryptedPage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'create') {
      // Créer une nouvelle page avec encryption et tokens NLP
      const encryptedUrl = await cryptoService.encrypt(url)
      const encryptedTitle = await cryptoService.encrypt(title || '')
      const encryptedDescription = await cryptoService.encrypt(description || '')
      const encryptedDomain = await cryptoService.encrypt(domain || '')

      // Générer les tokens NLP
      const searchContent = `${title || ''} ${description || ''} ${url}`
      const tokens = await cryptoService.generateQueryTokens(searchContent)

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

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, page: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'update') {
      // Mettre à jour une page avec encryption
      const updates: any = {
        updated_at: new Date().toISOString(),
      }

      if (url !== undefined) updates.url = await cryptoService.encrypt(url)
      if (title !== undefined) updates.title = await cryptoService.encrypt(title)
      if (description !== undefined) updates.description = await cryptoService.encrypt(description)
      if (domain !== undefined) updates.domain = await cryptoService.encrypt(domain)

      // Si le contenu a changé, régénérer les tokens
      if (title !== undefined || description !== undefined) {
        const currentPage = await supabase.from('crawled_pages').select('*').eq('id', id).single()
        if (currentPage.data) {
          const currentUrl = url !== undefined ? url : await cryptoService.decrypt(currentPage.data.url)
          const currentTitle = title !== undefined ? title : await cryptoService.decrypt(currentPage.data.title)
          const currentDescription = description !== undefined ? description : await cryptoService.decrypt(currentPage.data.description)
          
          const searchContent = `${currentTitle} ${currentDescription} ${currentUrl}`
          updates.blind_index = await cryptoService.generateQueryTokens(searchContent)
        }
      }

      const { data, error } = await supabase
        .from('crawled_pages')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return new Response(
        JSON.stringify({ success: true, page: data }),
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