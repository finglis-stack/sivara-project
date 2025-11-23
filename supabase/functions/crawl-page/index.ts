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
// Il transforme le texte brut en empreintes cryptographiques intelligentes.

class TitaniumTokenizer {
  // Stopwords (Mots vides à ignorer pour réduire le bruit)
  public static STOPWORDS = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 
    'de', 'du', 'en', 'à', 'dans', 'par', 'pour', 'sur', 'avec', 'sans', 'sous', 'ce', 'se',
    'qui', 'que', 'quoi', 'dont', 'où', 'est', 'sont', 'ont', 'il', 'ils', 'elle', 'elles',
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
  ]);

  /**
   * Normalise le texte : minuscule, suppression accents, caractères spéciaux
   */
  static normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Enlève les accents
      .replace(/[^a-z0-9\s]/g, " ") // Garde seulement alphanum
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Stemming léger (Racination) pour FR/EN
   * Transforme "mangerons" -> "mang", "files" -> "file"
   */
  static getStem(word: string): string {
    if (word.length <= 4) return word;
    
    // Règles simples mais efficaces (80/20 rule)
    // Pluriels et terminaisons communes
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    if (word.endsWith('aux')) return word.slice(0, -2) + 'l'; // Chevaux -> Cheval
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

  /**
   * Algorithme Phonétique Simplifié (Mix Soundex/Metaphone)
   * Permet de matcher "Philo" et "Filo"
   */
  static getPhoneticFingerprint(word: string): string {
    let code = word.toUpperCase();
    
    // 1. Substitutions phonétiques majeures
    code = code.replace(/PH/g, 'F');
    code = code.replace(/CH/g, 'K'); // "Chorale" -> "Korale" (Approximation)
    code = code.replace(/QU/g, 'K');
    code = code.replace(/C([E|I|Y])/g, 'S$1'); // Ce -> Se
    code = code.replace(/C/g, 'K'); // Ca -> Ka
    code = code.replace(/GI/g, 'JI');
    code = code.replace(/GE/g, 'JE');
    
    // 2. Suppression des voyelles sauf la première (Style Soundex)
    const firstChar = code.charAt(0);
    const rest = code.slice(1).replace(/[AEIOUHYW]/g, '');
    
    // 3. Suppression des doublons
    const cleanRest = rest.replace(/(.)\1+/g, '$1');
    
    return (firstChar + cleanRest).substring(0, 4); // Garde 4 chars max
  }

  /**
   * Génère les N-Grams (Trigrammes et Quadgrammes)
   */
  static getNGrams(word: string, n: number): string[] {
    if (word.length < n) return [];
    const ngrams = [];
    for (let i = 0; i <= word.length - n; i++) {
      ngrams.push(word.substring(i, i + n));
    }
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
    
    this.key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const searchKeyData = await crypto.subtle.digest('SHA-256', keyData);
    this.searchKey = await crypto.subtle.importKey(
      'raw',
      searchKeyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
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

  // --- GÉNÉRATION INTELLIGENTE DES TOKENS ---
  async generateBlindIndex(text: string): Promise<string[]> {
    if (!this.searchKey) throw new Error('Search key not initialized');
    
    const tokens = new Set<string>();
    const normalizedText = TitaniumTokenizer.normalize(text);
    const words = normalizedText.split(' ').filter(w => w.length > 1);

    for (const rawWord of words) {
      // 0. Filtre Stopwords (sauf si le mot est très rare, mais ici on simplifie)
      if (TitaniumTokenizer.STOPWORDS.has(rawWord)) continue;

      // 1. Hash EXACT (Le mot tel quel) -> Score Maximum
      tokens.add(await this.hmacToken(`EX:${rawWord}`));

      // 2. Hash STEM (La racine) -> Score Élevé
      // Permet de trouver "Chevaux" en tapant "Cheval"
      const stem = TitaniumTokenizer.getStem(rawWord);
      if (stem !== rawWord) {
        tokens.add(await this.hmacToken(`ST:${stem}`));
      }

      // 3. Hash PHONETIC (Le son) -> Score Moyen (Tolérance fautes)
      // Permet de trouver "Philo" en tapant "Filo"
      const phone = TitaniumTokenizer.getPhoneticFingerprint(rawWord);
      if (phone.length > 1) {
        tokens.add(await this.hmacToken(`PH:${phone}`));
      }

      // 4. N-GRAMS (3 et 4 lettres) -> Score Faible (Fuzzy brut)
      // Permet de trouver des bouts de mots
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
    // On signe le token "typé" (ex: "PH:F821")
    const signature = await crypto.subtle.sign(
      'HMAC',
      this.searchKey!,
      encoder.encode(input)
    );
    // On garde 8 bytes pour l'index (compromis collision/taille)
    return btoa(String.fromCharCode(...new Uint8Array(signature).slice(0, 8)));
  }
}

// ==========================================
// 🕷️ CRAWLER LOGIC
// ==========================================

function isAllowedLanguage(html: string): boolean {
  // Détection sommaire
  const langMatch = html.match(/<html[^>]+lang=["']([a-zA-Z\-]+)["'][^>]*>/i);
  if (langMatch) {
    const lang = langMatch[1].toLowerCase();
    return lang.startsWith('fr') || lang.startsWith('en');
  }
  // Fallback heuristique
  const textSample = html.substring(0, 2000).toLowerCase();
  const frCount = (textSample.match(/\b(le|la|et|est|pour|dans)\b/g) || []).length;
  const enCount = (textSample.match(/\b(the|and|is|for|with|that)\b/g) || []).length;
  return frCount > 2 || enCount > 2;
}

function extractMetadata(html: string, url: string): { title: string, description: string, content: string } {
  // Extraction Titre
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = titleMatch ? titleMatch[1].trim() : 'Sans titre';
  
  // Nettoyage Titre générique
  const urlObj = new URL(url);
  const domainName = urlObj.hostname.replace('www.', '');
  if (title.length < 5 || /home|accueil|index/i.test(title)) {
    title = `${title} - ${domainName}`;
  }

  // Extraction Description
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const description = descMatch ? descMatch[1].trim() : '';

  // Extraction Contenu (Nettoyage brutal)
  let content = html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, " ")
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, ' ') // Strip tags
    .replace(/\s+/g, ' ')     // Normalize spaces
    .trim();

  return {
    title: title.substring(0, 255),
    description: description.substring(0, 500),
    content: content.substring(0, 10000) // Limite saine pour le stockage
  };
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
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY not configured')

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

    // 3. ENCRYPT & INDEX
    await logToDb(queueId, 'Generating Titanium Blind Index...', 'ENCRYPTION', 'info');

    // Chiffrement des données (Payload illisible par le serveur)
    const encryptedTitle = await cryptoService.encrypt(metadata.title)
    const encryptedDescription = await cryptoService.encrypt(metadata.description)
    const encryptedContent = await cryptoService.encrypt(metadata.content)
    const encryptedUrl = await cryptoService.encrypt(url, true)
    const encryptedDomain = await cryptoService.encrypt(urlObj.hostname)
    
    // Hash pour dédoublonnage (pas pour la recherche)
    const searchHash = await cryptoService.hash(url);

    // GÉNÉRATION DU BLIND INDEX AVANCÉ
    // On indexe le titre, la description et le début du contenu
    // C'est ici que le Titanium Tokenizer fait son boulot
    const textToIndex = `${metadata.title} ${metadata.description} ${metadata.content.substring(0, 2000)}`;
    const blindIndex = await cryptoService.generateBlindIndex(textToIndex);

    // Upsert
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
        blind_index: blindIndex, // Tableau de tokens cryptés (EX:..., ST:..., PH:..., TG:...)
        updated_at: new Date().toISOString()
      }, { onConflict: 'url' })

    if (error) throw error

    await logToDb(queueId, `Indexed ${blindIndex.length} tokens (Exact/Stem/Phone/Ngrams)`, 'COMPLETE', 'success');
    try { await supabase.rpc('increment_crawl_stats') } catch (e) {}

    return new Response(JSON.stringify({ success: true, tokens: blindIndex.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[CRAWL ERROR]', error)
    await logToDb(queueId, `Error: ${error.message}`, 'ERROR', 'error');
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})