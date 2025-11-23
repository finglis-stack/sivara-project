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
// Ce moteur doit être IDENTIQUE entre crawl-page et search.

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

class CryptoService {
  private key: CryptoKey | null = null;
  private searchKey: CryptoKey | null = null;

  async initialize(secretKey: string) {
    const keyData = encoder.encode(secretKey.padEnd(32, '0').substring(0, 32));
    this.key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const searchKeyData = await crypto.subtle.digest('SHA-256', keyData);
    this.searchKey = await crypto.subtle.importKey('raw', searchKeyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  }

  async encrypt(text: string, deterministic: boolean = false): Promise<string> {
    if (!this.key) throw new Error('Crypto not initialized');
    let iv: Uint8Array;
    if (deterministic) {
       const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(text));
       iv = new Uint8Array(hashBuffer).slice(0, 12);
    } else {
       iv = crypto.getRandomValues(new Uint8Array(12));
    }
    const data = encoder.encode(text);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.key, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    return btoa(String.fromCharCode(...combined));
  }

  async hash(text: string): Promise<string> {
    const data = encoder.encode(text.toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async generateBlindIndex(text: string): Promise<string[]> {
    if (!this.searchKey) throw new Error('Search key not initialized');
    const tokens = new Set<string>();
    const normalizedText = TitaniumTokenizer.normalize(text);
    const words = normalizedText.split(' ').filter(w => w.length > 1);

    for (const rawWord of words) {
      if (TitaniumTokenizer.STOPWORDS.has(rawWord)) continue;
      tokens.add(await this.hmacToken(`EX:${rawWord}`));
      
      const stem = TitaniumTokenizer.getStem(rawWord);
      if (stem !== rawWord) tokens.add(await this.hmacToken(`ST:${stem}`));
      
      const phone = TitaniumTokenizer.getPhoneticFingerprint(rawWord);
      if (phone.length > 1) tokens.add(await this.hmacToken(`PH:${phone}`));
      
      if (rawWord.length > 3) {
        const trigrams = TitaniumTokenizer.getNGrams(rawWord, 3);
        for (const tri of trigrams) tokens.add(await this.hmacToken(`TG:${tri}`));
      }
      if (rawWord.length > 4) {
        const quadgrams = TitaniumTokenizer.getNGrams(rawWord, 4);
        for (const quad of quadgrams) tokens.add(await this.hmacToken(`QG:${quad}`));
      }
    }
    return Array.from(tokens);
  }

  private async hmacToken(input: string): Promise<string> {
    const signature = await crypto.subtle.sign('HMAC', this.searchKey!, encoder.encode(input));
    return btoa(String.fromCharCode(...new Uint8Array(signature).slice(0, 8)));
  }
}

// ==========================================
// 🕷️ CRAWLER LOGIC
// ==========================================

function isAllowedLanguage(html: string): boolean {
  const langMatch = html.match(/<html[^>]+lang=["']([a-zA-Z\-]+)["'][^>]*>/i);
  if (langMatch) {
    const lang = langMatch[1].toLowerCase();
    return lang.startsWith('fr') || lang.startsWith('en');
  }
  const textSample = html.substring(0, 2000).toLowerCase();
  const frCount = (textSample.match(/\b(le|la|et|est|pour|dans)\b/g) || []).length;
  const enCount = (textSample.match(/\b(the|and|is|for|with|that)\b/g) || []).length;
  return frCount > 2 || enCount > 2;
}

function extractMetadata(html: string, url: string): { title: string, description: string, content: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = titleMatch ? titleMatch[1].trim() : 'Sans titre';
  const urlObj = new URL(url);
  const domainName = urlObj.hostname.replace('www.', '');
  if (title.length < 5 || /home|accueil|index/i.test(title)) {
    title = `${title} - ${domainName}`;
  }
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const description = descMatch ? descMatch[1].trim() : '';
  let content = html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, " ")
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, ' ') 
    .replace(/\s+/g, ' ')     
    .trim();

  return {
    title: title.substring(0, 255),
    description: description.substring(0, 500),
    content: content.substring(0, 10000)
  };
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const regex = /href=["']([^"']+)["']/g;
  let match;
  const baseObj = new URL(baseUrl);

  while ((match = regex.exec(html)) !== null) {
    try {
      const link = match[1];
      const absoluteUrl = new URL(link, baseUrl).href;
      const urlObj = new URL(absoluteUrl);

      // Filtres de base : HTTP/S uniquement, même domaine
      if (!['http:', 'https:'].includes(urlObj.protocol)) continue;
      if (urlObj.hostname !== baseObj.hostname) continue; // Restrict to same domain for now
      
      // Filtres extensions
      if (/\.(jpg|jpeg|png|gif|pdf|zip|css|js)$/i.test(urlObj.pathname)) continue;

      // Suppression des ancres
      urlObj.hash = '';
      
      links.add(urlObj.href);
    } catch (e) {
      // Ignore invalid URLs
    }
  }
  return Array.from(links);
}

// @ts-ignore: Deno types
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // @ts-ignore
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  // @ts-ignore
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  let queueId = null;

  const logToDb = async (qId: string | null, message: string, step: string, status: string = 'info') => {
    console.log(`[${step}] ${message}`);
    if (qId) {
      await supabase.from('crawl_logs').insert({ queue_id: qId, message, step, status });
    }
  };

  try {
    // @ts-ignore
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!
    const cryptoService = new CryptoService()
    await cryptoService.initialize(encryptionKey)

    const body = await req.json();
    const url = body.url;
    queueId = body.queueId || null;

    if (!url) throw new Error('URL is required')

    // 1. FETCH
    await logToDb(queueId, `Crawling: ${url}`, 'INIT', 'info');
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SivaraBot/2.0 (Badass-Edition; +http://sivara.search)' }
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const rawHtml = await response.text();

    if (!isAllowedLanguage(rawHtml)) throw new Error('Language not supported');

    // 2. PARSE
    await logToDb(queueId, `Parsing & Tokenizing...`, 'PARSING', 'info');
    const metadata = extractMetadata(rawHtml, url);
    const urlObj = new URL(url);

    // 3. CHECK SETTINGS FOR DISCOVERY
    const { data: settings } = await supabase.from('crawler_settings').select('discovery_enabled').eq('id', 1).single();
    const discoveryEnabled = settings?.discovery_enabled !== false;

    // 4. DISCOVERY MODE
    if (discoveryEnabled) {
       await logToDb(queueId, `Discovery Mode ON: Extracting links...`, 'DISCOVERY', 'info');
       const links = extractLinks(rawHtml, url);
       let addedCount = 0;

       // Optimisation : On vérifie les doublons en calculant les hashs d'abord
       // Note : C'est lourd si la page a 1000 liens, mais c'est nécessaire pour ne pas polluer
       for (const link of links.slice(0, 50)) { // Limite à 50 liens par page pour éviter l'explosion
          const linkHash = await cryptoService.hash(link);
          
          // Vérif si déjà crawlé
          const { data: existing } = await supabase.from('crawled_pages').select('id').eq('search_hash', linkHash).single();
          
          // Vérif si déjà en queue (Approximation : on ne peut pas vérifier facilement car URL chiffrée avec IV random)
          // Pour l'instant, on ajoute. process-queue peut re-vérifier plus tard.
          
          if (!existing) {
             const encryptedLink = await cryptoService.encrypt(link);
             const { error } = await supabase.from('crawl_queue').insert({
                url: encryptedLink,
                priority: 0, // Priorité basse pour la découverte
                status: 'pending',
                added_at: new Date().toISOString()
             });
             if (!error) addedCount++;
          }
       }
       if (addedCount > 0) {
          await logToDb(queueId, `Discovered +${addedCount} new links`, 'DISCOVERY', 'success');
       }
    }

    // 5. ENCRYPT & INDEX
    await logToDb(queueId, 'Generating Titanium Blind Index...', 'ENCRYPTION', 'info');

    const encryptedTitle = await cryptoService.encrypt(metadata.title)
    const encryptedDescription = await cryptoService.encrypt(metadata.description)
    const encryptedContent = await cryptoService.encrypt(metadata.content)
    const encryptedUrl = await cryptoService.encrypt(url, true)
    const encryptedDomain = await cryptoService.encrypt(urlObj.hostname)
    
    const searchHash = await cryptoService.hash(url);

    const textToIndex = `${metadata.title} ${metadata.description} ${metadata.content.substring(0, 2000)}`;
    const blindIndex = await cryptoService.generateBlindIndex(textToIndex);

    const { error } = await supabase
      .from('crawled_pages')
      .upsert({
        url: encryptedUrl,
        title: encryptedTitle,
        description: encryptedDescription,
        content: encryptedContent,
        domain: encryptedDomain,
        http_status: response.status,
        status: 'success',
        search_hash: searchHash,
        blind_index: blindIndex,
        updated_at: new Date().toISOString()
      }, { onConflict: 'url' })

    if (error) throw error

    await logToDb(queueId, `Indexed ${blindIndex.length} tokens`, 'COMPLETE', 'success');
    try { await supabase.rpc('increment_crawl_stats') } catch (e) {}

    return new Response(JSON.stringify({ success: true, tokens: blindIndex.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[CRAWL ERROR]', error)
    await logToDb(queueId, `Error: ${error.message}`, 'ERROR', 'error');
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})