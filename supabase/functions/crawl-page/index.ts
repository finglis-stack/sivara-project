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

function extractLinks(html: string, baseUrl: string): { url: string, text: string }[] {
  const links: { url: string, text: string }[] = [];
  const regex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  let match;
  
  const baseDomain = new URL(baseUrl).hostname.replace('www.', '');

  while ((match = regex.exec(html)) !== null) {
    try {
      const href = match[1];
      const text = match[2].replace(/<[^>]+>/g, '').trim(); // Clean tags inside a
      
      // Ignore anchors, javascript, mailto
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || !text) continue;

      const absoluteUrl = new URL(href, baseUrl);
      
      // Keep only same domain
      if (!absoluteUrl.hostname.includes(baseDomain)) continue;

      // Avoid duplicates in the current list
      if (!links.some(l => l.url === absoluteUrl.href)) {
        links.push({ url: absoluteUrl.href, text: text.substring(0, 50) });
      }
    } catch (e) { continue; }
  }
  return links.slice(0, 50); // Limit to 50 candidates for AI analysis
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
  
  let queueId = null;
  let currentUrl = '';
  let cryptoService: CryptoService | null = null;

  // Helper pour logger en DB
  const logToDb = async (qId: string | null, message: string, step: string, status: string = 'info') => {
    console.log(`[${step}] ${message}`);
    if (qId) {
      await supabase.from('crawl_logs').insert({
        queue_id: qId,
        message,
        step,
        status
      });
    }
  };

  try {
    // @ts-ignore
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!
    // @ts-ignore
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!
    // @ts-ignore
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'; // Faster model for scraping
    
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY not configured')
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured')

    cryptoService = new CryptoService()
    await cryptoService.initialize(encryptionKey)

    const body = await req.json();
    const url = body.url;
    const maxDepth = body.maxDepth || 0; // Depth logic managed by priority now
    queueId = body.queueId || null;
    currentUrl = url;

    if (!url) throw new Error('URL is required')

    await logToDb(queueId, `Starting smart crawl for: ${url}`, 'INIT', 'info');

    // 1. Fetcher le contenu brut
    await logToDb(queueId, 'Fetching URL content...', 'SCRAPING', 'info');
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'SivaraBot/3.0 (AI Powered Indexer)',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    const textDecoder = new TextDecoder('utf-8')
    const rawHtml = textDecoder.decode(buffer)

    await logToDb(queueId, `Content fetched. Extracting candidates...`, 'SCRAPING', 'success');

    // 2. Préparation des données pour l'IA
    const candidateLinks = extractLinks(rawHtml, url);
    
    const cleanedText = rawHtml
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 30000); // Increased context

    // 3. Analyse IA
    await logToDb(queueId, `Consulting AI for content & priority analysis...`, 'AI_ANALYSIS', 'info');
    
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    const prompt = `
    Tu es un robot d'indexation intelligent. Analyse cette page web.

    URL: ${url}
    
    TACHE 1 : Contenu
    - Extrais le TITRE principal.
    - Fais une DESCRIPTION SEO.
    - Reformule le CONTENU en français, dense et informatif.

    TACHE 2 : Découverte de liens intelligente
    Voici une liste de liens trouvés sur la page :
    ${JSON.stringify(candidateLinks)}

    Analyse ces liens et sélectionne UNIQUEMENT ceux qui sont pertinents à ajouter à la file d'attente.
    CRITÈRES DE PRIORITÉ (Score 0-10) :
    - 10 : Pages produits, Pages principales, Documentation clé.
    - 8-9 : Sous-catégories, Articles de blog pertinents, Page de compte (Login/Dashboard).
    - 5-7 : Pages "À propos", Contact.
    - 0-3 : Pages 404, CGU, Politique de confidentialité, Liens de désinscription, Panier vide, Liens cassés probables.
    - IGNORE : Les liens externes (Facebook, Twitter, etc), les ancres (#).

    Format JSON attendu :
    {
      "title": "...",
      "description": "...",
      "rephrased_content": "...",
      "discovered_urls": [
        { "url": "https://...", "priority": 9 },
        { "url": "https://...", "priority": 5 }
      ]
    }
    
    Contenu de la page (extrait) :
    ${cleanedText}
    `;

    const result = await model.generateContent(prompt);
    const aiResponseText = result.response.text();
    
    let aiData;
    try {
      aiData = JSON.parse(cleanJsonString(aiResponseText));
    } catch (e) {
      console.error("JSON Parse Error", aiResponseText);
      throw new Error("AI Failed to produce valid JSON");
    }

    // 4. Cryptage et Sauvegarde
    await logToDb(queueId, 'Encrypting and indexing...', 'ENCRYPTION', 'info');

    const urlObj = new URL(url)
    const domain = urlObj.hostname
    
    const encryptedTitle = await cryptoService.encrypt(aiData.title || 'Sans titre')
    const encryptedDescription = await cryptoService.encrypt(aiData.description || '')
    const encryptedContent = await cryptoService.encrypt(aiData.rephrased_content || '')
    const encryptedUrl = await cryptoService.encrypt(url)
    const encryptedDomain = await cryptoService.encrypt(domain)
    const searchHash = await cryptoService.hash(aiData.title + ' ' + aiData.description + ' ' + aiData.rephrased_content)

    // Upsert dans crawled_pages
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
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'url'
      })

    if (error) throw error

    // 5. Gestion de la file d'attente (Links Discovery)
    if (aiData.discovered_urls && Array.isArray(aiData.discovered_urls)) {
      const highValueLinks = aiData.discovered_urls.filter((l: any) => l.priority >= 5); // Seuil de pertinence
      
      await logToDb(queueId, `AI found ${highValueLinks.length} relevant links (out of ${candidateLinks.length})`, 'DISCOVERY', 'success');

      for (const link of highValueLinks) {
        try {
          const linkEncrypted = await cryptoService.encrypt(link.url);
          
          // On insert seulement si ça n'existe pas déjà pour éviter les boucles infinies
          // On utilise le score de l'IA comme priorité
          await supabase.from('crawl_queue')
            .upsert({
              url: linkEncrypted,
              priority: link.priority, // Priorité définie par l'IA
              status: 'pending'
            }, { onConflict: 'url', ignoreDuplicates: true });
            
        } catch (err) {
          console.error("Link add error", err);
        }
      }
    }

    await logToDb(queueId, 'Crawl completed successfully', 'COMPLETE', 'success');

    // Update stats
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

    // NETTOYAGE INTELLIGENT
    // Si le crawl a échoué, on s'assure que cette URL n'est PAS dans l'index de recherche
    if (currentUrl && cryptoService) {
      try {
        await logToDb(queueId, `Cleaning up failed URL from index...`, 'CLEANUP', 'info');
        const encryptedUrlToDelete = await cryptoService.encrypt(currentUrl);
        await supabase.from('crawled_pages').delete().eq('url', encryptedUrlToDelete);
      } catch (cleanupError) {
        console.error("Cleanup failed", cleanupError);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})