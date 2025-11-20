// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
// @ts-ignore: Deno types
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.1.3'

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

  try {
    // @ts-ignore: Deno types
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    // @ts-ignore: Deno types
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // @ts-ignore: Deno types
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY')!
    // @ts-ignore: Deno types
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')!
    // @ts-ignore: Deno types
    // Utilise GEMINI_MODEL si défini, sinon fallback sur gemini-1.5-pro
    const geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-1.5-pro';
    
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY not configured')
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured')

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const cryptoService = new CryptoService()
    await cryptoService.initialize(encryptionKey)

    const { url, maxDepth = 1 } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[AI CRAWL] Starting AI-powered crawl for: ${url} using model: ${geminiModel}`)

    // 1. Fetcher le contenu brut
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

    // 2. Nettoyage pré-IA
    const cleanedText = rawHtml
      .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
      .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "")
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 40000); // Augmentation de la limite de tokens pour les modèles Pro

    // 3. Analyse via Gemini
    console.log(`[GEMINI] Sending content to ${geminiModel} for analysis...`)
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: geminiModel });

    const prompt = `
    Tu es un expert en indexation web sémantique avancée. Analyse le contenu textuel suivant provenant de l'URL: ${url}
    
    Tâche :
    1. TITRE : Identifie le titre principal (le sujet réel de la page).
    2. DESCRIPTION : Rédige une description concise, accrocheuse et optimisée SEO.
    3. CONTENU : Reformule le contenu principal en un texte structuré, très dense en informations factuelles (environ 400-600 mots). Supprime tout bruit (menus, footers, pubs, navigation). Synthétise les idées clés.
    4. LIENS : Extrais les liens secondaires pertinents qui semblent être des articles ou des pages de contenu de qualité sur le même domaine.

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
    } catch (e) {
      console.error("Erreur parsing JSON Gemini:", e);
      aiData = {
        title: "Erreur analyse IA",
        description: "Le contenu n'a pas pu être analysé correctement.",
        rephrased_content: cleanedText.substring(0, 1000),
        secondary_links: []
      };
    }

    console.log(`[GEMINI] Analysis complete. Title: ${aiData.title}`)

    const urlObj = new URL(url)
    const domain = urlObj.hostname

    console.log(`[ENCRYPTION] Encrypting AI-generated data...`)
    
    // 4. Cryptage des données générées par l'IA
    const encryptedTitle = await cryptoService.encrypt(aiData.title)
    const encryptedDescription = await cryptoService.encrypt(aiData.description)
    const encryptedContent = await cryptoService.encrypt(aiData.rephrased_content)
    const encryptedUrl = await cryptoService.encrypt(url)
    const encryptedDomain = await cryptoService.encrypt(domain)
    
    const searchHash = await cryptoService.hash(aiData.title + ' ' + aiData.description + ' ' + aiData.rephrased_content)

    // 5. Sauvegarde
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

    // 6. Gestion des liens secondaires
    if (maxDepth > 0 && aiData.secondary_links && Array.isArray(aiData.secondary_links)) {
      const validLinks = aiData.secondary_links
        .filter(link => {
          try {
            const linkUrl = new URL(link, url);
            return linkUrl.hostname.includes(domain.replace('www.', '')) || domain.includes(linkUrl.hostname.replace('www.', ''));
          } catch {
            return false;
          }
        })
        .map(link => new URL(link, url).href)
        .slice(0, 5);

      console.log(`[QUEUE] Adding ${validLinks.length} AI-selected links to queue`)

      for (const link of validLinks) {
        const encryptedLink = await cryptoService.encrypt(link)
        await supabase
          .from('crawl_queue')
          .upsert({
            url: encryptedLink,
            priority: maxDepth - 1,
            status: 'pending'
          }, {
            onConflict: 'url',
            ignoreDuplicates: true
          })
      }
    }

    // Mettre à jour les stats
    const { data: stats } = await supabase
      .from('crawl_stats')
      .select('*')
      .single()

    if (stats) {
      await supabase
        .from('crawl_stats')
        .update({
          total_pages: stats.total_pages + 1,
          last_crawl_at: new Date().toISOString(),
          pages_crawled_today: stats.pages_crawled_today + 1,
        })
        .eq('id', stats.id)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Page analyzed by ${geminiModel}, rephrased, and encrypted securely`,
        ai_title: aiData.title,
        model_used: geminiModel,
        encryption: 'AES-256-GCM'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[CRAWL ERROR]', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})