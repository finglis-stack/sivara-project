// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore: Deno types
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.12.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore: Deno types
const encoder = new TextEncoder();

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

  async encrypt(text: string): Promise<string> {
    if (!this.key) throw new Error('Crypto not initialized');
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = encoder.encode(text);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key,
      data
    );
    
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  }

  async hash(text: string): Promise<string> {
    const data = encoder.encode(text.toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

function cleanJsonString(str: string): string {
  return str.replace(/^```json\s*/, '').replace(/\s*```$/, '');
}

// @ts-ignore: Deno types
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Initialisation Supabase au scope global pour le logging
  // @ts-ignore
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  // @ts-ignore
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  // Helper pour logger en DB
  const logToDb = async (queueId: string | null, message: string, step: string, status: string = 'info') => {
    console.log(`[${step}] ${message}`);
    if (queueId) {
      await supabase.from('crawl_logs').insert({
        queue_id: queueId,
        message,
        step,
        status
      });
    }
  };

  let queueId = null;

  try {
    // @ts-ignore
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!
    // @ts-ignore
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!
    // @ts-ignore
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-3-pro-preview';
    
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY not configured')
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured')

    const cryptoService = new CryptoService()
    await cryptoService.initialize(encryptionKey)

    const body = await req.json();
    const url = body.url;
    const maxDepth = body.maxDepth || 1;
    queueId = body.queueId || null;

    if (!url) throw new Error('URL is required')

    await logToDb(queueId, `Starting crawl for: ${url}`, 'INIT', 'info');
    await logToDb(queueId, `Using AI Model: ${geminiModel}`, 'INIT', 'info');

    // 1. Fetcher le contenu brut
    await logToDb(queueId, 'Fetching URL content...', 'SCRAPING', 'info');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SivaraBot/3.0 (AI Powered Indexer)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    const textDecoder = new TextDecoder('utf-8')
    const rawHtml = textDecoder.decode(buffer)

    await logToDb(queueId, `Content fetched (${rawHtml.length} bytes). Cleaning HTML...`, 'SCRAPING', 'success');

    // 2. Nettoyage
    const cleanedText = rawHtml
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50000);

    // 3. Analyse IA
    await logToDb(queueId, `Sending ${cleanedText.length} chars to ${geminiModel}...`, 'AI_ANALYSIS', 'info');
    
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ 
      model: geminiModel,
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ]
    });

    const prompt = `
    Tu es un expert en indexation web sémantique avancée. Analyse le contenu textuel suivant provenant de l'URL: ${url}
    
    Tâche :
    1. TITRE : Identifie le titre principal (le sujet réel de la page).
    2. DESCRIPTION : Rédige une description concise, accrocheuse et optimisée SEO.
    3. CONTENU : Reformule le contenu principal en un texte structuré, très dense en informations factuelles (environ 400-600 mots). Supprime tout bruit.
    4. LIENS : Extrais les liens secondaires pertinents.

    Format de réponse attendu (JSON pur uniquement) :
    {
      "title": "Titre optimisé",
      "description": "Description optimisée",
      "rephrased_content": "Contenu reformulé riche...",
      "main_topic": "Sujet principal",
      "secondary_links": ["url1", "url2", ...]
    }

    Contenu à analyser :
    ${cleanedText}
    `;

    const result = await model.generateContent(prompt);
    const aiResponseText = result.response.text();
    
    let aiData;
    try {
      aiData = JSON.parse(cleanJsonString(aiResponseText));
      await logToDb(queueId, `AI Analysis successful. Title: ${aiData.title}`, 'AI_ANALYSIS', 'success');
    } catch (e) {
      await logToDb(queueId, `JSON Parse Error: ${e.message}`, 'AI_ANALYSIS', 'error');
      aiData = {
        title: "Erreur analyse IA",
        description: "Le contenu n'a pas pu être analysé correctement.",
        rephrased_content: cleanedText.substring(0, 1000),
        secondary_links: []
      };
    }

    // 4. Cryptage
    await logToDb(queueId, 'Encrypting data with AES-256-GCM...', 'ENCRYPTION', 'info');

    const urlObj = new URL(url)
    const domain = urlObj.hostname
    
    const encryptedTitle = await cryptoService.encrypt(aiData.title)
    const encryptedDescription = await cryptoService.encrypt(aiData.description)
    const encryptedContent = await cryptoService.encrypt(aiData.rephrased_content)
    const encryptedUrl = await cryptoService.encrypt(url)
    const encryptedDomain = await cryptoService.encrypt(domain)
    
    const searchHash = await cryptoService.hash(aiData.title + ' ' + aiData.description + ' ' + aiData.rephrased_content)

    // 5. Sauvegarde
    await logToDb(queueId, 'Saving to encrypted database...', 'SAVING', 'info');

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
      }, {
        onConflict: 'url'
      })

    if (error) throw error

    // 6. Liens secondaires
    if (maxDepth > 0 && aiData.secondary_links && Array.isArray(aiData.secondary_links)) {
      const validLinks = aiData.secondary_links
        .filter(link => {
          try {
            const linkUrl = new URL(link, url);
            return linkUrl.hostname.includes(domain.replace('www.', '')) || domain.includes(linkUrl.hostname.replace('www.', ''));
          } catch { return false; }
        })
        .map(link => new URL(link, url).href)
        .slice(0, 5);

      await logToDb(queueId, `Found ${validLinks.length} related links`, 'DISCOVERY', 'info');

      for (const link of validLinks) {
        const encryptedLink = await cryptoService.encrypt(link)
        await supabase.from('crawl_queue').upsert({
            url: encryptedLink,
            priority: maxDepth - 1,
            status: 'pending'
          }, { onConflict: 'url', ignoreDuplicates: true })
      }
    }

    await logToDb(queueId, 'Crawl completed successfully', 'COMPLETE', 'success');

    // Update stats...
    const { data: stats } = await supabase.from('crawl_stats').select('*').single()
    if (stats) {
      await supabase.from('crawl_stats').update({
          total_pages: stats.total_pages + 1,
          last_crawl_at: new Date().toISOString(),
          pages_crawled_today: stats.pages_crawled_today + 1,
        }).eq('id', stats.id)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[CRAWL ERROR]', error)
    await logToDb(queueId, `Fatal Error: ${error.message}`, 'ERROR', 'error');
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})