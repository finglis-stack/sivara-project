// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore: Deno types
import { removeStopwords, fra, eng } from 'https://esm.sh/stopword@3.0.1'
// @ts-ignore: Deno types
import { decode } from 'https://esm.sh/html-entities@2.5.2'
// @ts-ignore: Deno types
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.13.0'

// --- FIX IMPORTS NATURAL (Default Exports) ---
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

class CryptoService {
  private key: CryptoKey | null = null;
  private searchKey: CryptoKey | null = null;

  async initialize(secretKey: string) {
    // SECURITY: Proper KDF via PBKDF2 (100k iterations, SHA-512)
    // MIGRATION: Existing crawled_pages data encrypted with old padEnd KDF must be re-crawled.
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
    // SECURITY: Always use random IV — deterministic IV destroys AES-GCM security guarantees
    const iv = crypto.getRandomValues(new Uint8Array(12));
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
    // Note: decode() has already been called on 'text' before passing it here
    const normalizedText = TitaniumTokenizer.normalize(text);
    const words = normalizedText.split(' ');
    const usefulWords = TitaniumTokenizer.filterStopwords(words);

    for (const rawWord of usefulWords) {
      tokens.add(await this.hmacToken(`EX:${rawWord}`));
      
      const stem = TitaniumTokenizer.getStem(rawWord);
      if (stem && stem !== rawWord) tokens.add(await this.hmacToken(`ST:${stem}`));
      
      const phone = TitaniumTokenizer.getPhoneticFingerprint(rawWord);
      if (phone && phone.length > 0) tokens.add(await this.hmacToken(`PH:${phone}`));
      
      if (rawWord.length > 3) {
        const trigrams = TitaniumTokenizer.getTrigrams(rawWord);
        for (const tri of trigrams) tokens.add(await this.hmacToken(`TG:${tri}`));
      }
    }
    return Array.from(tokens);
  }

  private async hmacToken(input: string): Promise<string> {
    const signature = await crypto.subtle.sign('HMAC', this.searchKey!, encoder.encode(input));
    return btoa(String.fromCharCode(...new Uint8Array(signature).slice(0, 8)));
  }
}

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

  // --- CLEANING: Decode HTML Entities (Fix for special chars like ' or é) ---
  title = decode(title);
  const cleanDescription = decode(description);
  content = decode(content);

  return {
    title: title.substring(0, 255),
    description: cleanDescription.substring(0, 500),
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
      // Decode potential entities in URL (e.g. &amp; -> &)
      const decodedLink = decode(link);
      const absoluteUrl = new URL(decodedLink, baseUrl).href;
      const urlObj = new URL(absoluteUrl);

      if (!['http:', 'https:'].includes(urlObj.protocol)) continue;
      if (urlObj.hostname !== baseObj.hostname) continue; 
      if (/\.(jpg|jpeg|png|gif|pdf|zip|css|js)$/i.test(urlObj.pathname)) continue;

      urlObj.hash = '';
      links.add(urlObj.href);
    } catch (e) {}
  }
  return Array.from(links);
}

// --- GEMINI AI ANALYSIS ---
async function analyzeWithGemini(title: string, description: string, content: string, domain: string): Promise<{ score: number, betterDescription: string, entity: any | null }> {
  // @ts-ignore
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    console.warn('[GEMINI] No API key found, skipping AI analysis');
    return { score: 0, betterDescription: description, entity: null };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // @ts-ignore
    const modelName = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({ model: modelName });

    const truncatedContent = content.substring(0, 3000);

    const prompt = `Tu es un analyste de sites web pour un moteur de recherche. Analyse cette page et retourne UNIQUEMENT un JSON valide, sans markdown, sans explication.

Page crawlée:
- Domaine: ${domain}
- Titre: ${title}
- Description actuelle: ${description}
- Extrait du contenu: ${truncatedContent}

Retourne ce JSON:
{
  "score": <nombre entier de 0 à 100 représentant l'importance/popularité estimée du site — 100 = site très connu et populaire mondialement comme Google ou Wikipedia, 50 = site moyen/régional, 10 = site personnel ou obscur>,
  "betterDescription": "<résumé factuel en 1-2 phrases de ce que fait ce site/cette page, en français, maximum 300 caractères>",
  "shouldCreateEntity": <true si le score >= 80 et le site est une entreprise/organisation connue/marque reconnue, false sinon>,
  "entity": <si shouldCreateEntity est true, un objet avec les détails suivants, sinon null:
    {
      "name": "Nom officiel",
      "phonetic": "Transcription phonétique (ex: /si.va.ʁa/ ou /ɡu.ɡœl/)",
      "description": "Une description TRÈS COMPLÈTE, détaillée et encyclopédique de l'entreprise, marque ou entité (minimum 3 à 4 paragraphes si possible).",
      "website_url": "URL officiel du site",
      "keywords": ["mot1", "mot2", "mot3", ...] (Une liste TRÈS COMPLÈTE de tous les mots-clés, synonymes, acronymes et fautes de frappe courantes qui seraient utilisés pour rechercher cette entité)
    }>
}

RÈGLES:
- Le score doit refléter la notoriété RÉELLE du domaine (pas seulement le contenu de la page).
- La description de la page (betterDescription) doit être neutre et factuelle.
- La description de l'entité (entity.description) doit être riche et complète.
- Ne crée une entité QUE pour des organisations/entreprises/institutions reconnues.
- Réponds UNIQUEMENT avec le JSON, aucun texte avant ou après.`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    
    // Nettoyage markdown éventuel
    if (text.startsWith('```json')) text = text.replace(/^```json\n?/g, '').replace(/```$/g, '').trim();
    if (text.startsWith('```')) text = text.replace(/^```\n?/g, '').replace(/```$/g, '').trim();

    const parsed = JSON.parse(text);

    return {
      score: Math.min(100, Math.max(0, parseInt(parsed.score) || 0)),
      betterDescription: (parsed.betterDescription || description).substring(0, 500),
      entity: parsed.shouldCreateEntity && parsed.entity ? parsed.entity : null,
    };
  } catch (e) {
    console.error('[GEMINI ERROR]', e);
    return { score: 0, betterDescription: description, entity: null };
  }
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
      headers: { 'User-Agent': 'SivaraBot/2.0 (Pro-Edition; +http://sivara.search)' }
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const rawHtml = await response.text();

    if (!isAllowedLanguage(rawHtml)) throw new Error('Language not supported');

    // 2. PARSE
    await logToDb(queueId, `Parsing & Cleaning (UTF-8)...`, 'PARSING', 'info');
    const metadata = extractMetadata(rawHtml, url);
    const urlObj = new URL(url);

    // 3. DISCOVERY MODE (1000 liens / 500ms delay)
    const { data: settings } = await supabase.from('crawler_settings').select('discovery_enabled').eq('id', 1).single();
    const discoveryEnabled = settings?.discovery_enabled !== false;

    if (discoveryEnabled) {
       await logToDb(queueId, `Discovery Mode: Pro Extraction...`, 'DISCOVERY', 'info');
       const links = extractLinks(rawHtml, url);
       let addedCount = 0;

       // --- PARAMÈTRES CARTOGRAPHIE COMPLÈTE ---
       const MAX_NEW_LINKS = 1000; 
       const SLOW_DELAY = 500; // 500ms

       for (const link of links.slice(0, MAX_NEW_LINKS)) {
          const linkHash = await cryptoService.hash(link);
          const { data: existing } = await supabase.from('crawled_pages').select('id').eq('search_hash', linkHash).single();
          
          if (!existing) {
             await new Promise(resolve => setTimeout(resolve, SLOW_DELAY));

             const encryptedLink = await cryptoService.encrypt(link);
             const { error } = await supabase.from('crawl_queue').insert({
                url: encryptedLink,
                priority: 0, 
                status: 'pending',
                added_at: new Date().toISOString()
             });
             if (!error) addedCount++;
          }
       }
       if (addedCount > 0) {
          await logToDb(queueId, `Queue +${addedCount} (Pro Mode)`, 'DISCOVERY', 'success');
       }
    }

    // 4. GEMINI AI ANALYSIS (Score, Reformulation, Entity)
    await logToDb(queueId, 'Analyzing with Gemini AI...', 'GEMINI', 'info');
    const geminiResult = await analyzeWithGemini(
      metadata.title, 
      metadata.description, 
      metadata.content, 
      urlObj.hostname
    );

    // Use Gemini's better description if available
    const finalDescription = geminiResult.betterDescription || metadata.description;
    await logToDb(queueId, `Gemini Score: ${geminiResult.score}/100`, 'GEMINI', 'success');

    // Auto-create entity if Gemini recommended it
    if (geminiResult.entity) {
      try {
        // Check if entity already exists by name
        const { data: existingEntity } = await supabase
          .from('search_entities')
          .select('id')
          .ilike('name', geminiResult.entity.name)
          .single();

        if (!existingEntity) {
          const { error: entityError } = await supabase
            .from('search_entities')
            .insert({
              name: geminiResult.entity.name,
              phonetic: geminiResult.entity.phonetic || null,
              description: geminiResult.entity.description,
              website_url: geminiResult.entity.website_url || `https://${urlObj.hostname}`,
              keywords: geminiResult.entity.keywords || [],
              priority: Math.floor(geminiResult.score / 10),
              is_public: false,
              source: 'gemini',
            });

          if (!entityError) {
            await logToDb(queueId, `Entity created: ${geminiResult.entity.name} (pending review)`, 'GEMINI', 'success');
          }
        }
      } catch (entityErr) {
        console.warn('[ENTITY CREATE]', entityErr);
      }
    }

    // 5. ENCRYPT & INDEX (Avec Natural Libs)
    await logToDb(queueId, 'Indexing with Natural NLP...', 'ENCRYPTION', 'info');

    const encryptedTitle = await cryptoService.encrypt(metadata.title)
    const encryptedDescription = await cryptoService.encrypt(finalDescription)
    const encryptedContent = await cryptoService.encrypt(metadata.content)
    const encryptedUrl = await cryptoService.encrypt(url)
    const encryptedDomain = await cryptoService.encrypt(urlObj.hostname)
    
    const searchHash = await cryptoService.hash(url);

    const textToIndex = `${metadata.title} ${finalDescription} ${metadata.content.substring(0, 2000)}`;
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
        gemini_score: geminiResult.score,
        updated_at: new Date().toISOString()
      }, { onConflict: 'search_hash' })

    if (error) throw error

    await logToDb(queueId, `Indexed ${blindIndex.length} tokens | Gemini: ${geminiResult.score}/100`, 'COMPLETE', 'success');
    try { await supabase.rpc('increment_crawl_stats') } catch (e) {}

    return new Response(JSON.stringify({ success: true, tokens: blindIndex.length, gemini_score: geminiResult.score }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('[CRAWL ERROR]', error)
    await logToDb(queueId, `Error: ${error.message}`, 'ERROR', 'error');
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})