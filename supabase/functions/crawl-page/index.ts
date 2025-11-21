// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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

function extractMetadata(html: string): { title: string, description: string, content: string } {
  // Extraction Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Sans titre';

  // Extraction Description (Meta)
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const description = descMatch ? descMatch[1].trim() : '';

  // Nettoyage du contenu pour la recherche (Body -> Text)
  // On enlève scripts, styles, commentaires, balises
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
    content: content.substring(0, 5000) // On garde un bon morceau pour l'indexation
  };
}

function extractLinks(html: string, baseUrl: string): { url: string, priority: number }[] {
  const links: { url: string, priority: number }[] = [];
  const regex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  let match;
  
  const baseHostname = new URL(baseUrl).hostname;

  while ((match = regex.exec(html)) !== null) {
    try {
      const href = match[1];
      const text = match[2].replace(/<[^>]+>/g, '').trim();
      
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || !text) continue;
      if (text.length < 2) continue;

      const absoluteUrl = new URL(href, baseUrl);
      
      // REGLE STRICTE : Même hostname uniquement (pas de sous-domaine différent, pas d'externe)
      if (absoluteUrl.hostname !== baseHostname) {
        continue;
      }
      
      // Pas de fichiers statiques
      if (absoluteUrl.pathname.match(/\.(jpg|jpeg|png|gif|pdf|zip|css|js)$/i)) {
        continue;
      }

      if (!links.some(l => l.url === absoluteUrl.href)) {
        // Calcul basique de priorité SEO
        let priority = 5;
        if (text.length > 20) priority += 1; // Lien avec ancre descriptive
        if (absoluteUrl.pathname.length < baseUrl.length + 10) priority += 2; // URL courte (souvent catégorie)
        
        links.push({ url: absoluteUrl.href, priority: Math.min(priority, 10) });
      }
    } catch (e) { continue; }
  }
  return links.slice(0, 30); // On limite à 30 liens par page pour ne pas exploser
}

// @ts-ignore: Deno types
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // @ts-ignore
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  // @ts-ignore
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  let queueId = null;
  let currentUrl = '';
  let cryptoService: CryptoService | null = null;

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
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY not configured')

    cryptoService = new CryptoService()
    await cryptoService.initialize(encryptionKey)

    const body = await req.json();
    const url = body.url;
    queueId = body.queueId || null;
    currentUrl = url;

    if (!url) throw new Error('URL is required')

    await logToDb(queueId, `Crawling: ${url}`, 'INIT', 'info');

    // 1. Fetching
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; SivaraBot/1.0; +http://sivara.search)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const rawHtml = await response.text();

    await logToDb(queueId, `Parsing SEO data...`, 'PARSING', 'info');
    
    // 2. Parsing (Algorithmic)
    const metadata = extractMetadata(rawHtml);
    const discoveredLinks = extractLinks(rawHtml, url);

    await logToDb(queueId, `Found: "${metadata.title}" & ${discoveredLinks.length} internal links`, 'PARSING', 'success');

    // 3. Encryption & Save
    await logToDb(queueId, 'Encrypting data...', 'ENCRYPTION', 'info');

    const urlObj = new URL(url)
    const domain = urlObj.hostname
    
    const encryptedTitle = await cryptoService.encrypt(metadata.title)
    const encryptedDescription = await cryptoService.encrypt(metadata.description)
    const encryptedContent = await cryptoService.encrypt(metadata.content)
    const encryptedDomain = await cryptoService.encrypt(domain)
    const encryptedUrl = await cryptoService.encrypt(url, true)
    
    // Hash pour la recherche (sur contenu clair)
    const searchHash = await cryptoService.hash(metadata.title + ' ' + metadata.description + ' ' + metadata.content)

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

    // 4. Ajout des nouveaux liens à la file d'attente
    if (discoveredLinks.length > 0) {
      let addedCount = 0;
      for (const link of discoveredLinks) {
        try {
          const linkEncrypted = await cryptoService.encrypt(link.url, true);
          // On ignore si existe déjà
          const { error: queueError } = await supabase.from('crawl_queue')
            .insert({
              url: linkEncrypted,
              priority: link.priority,
              status: 'pending'
            }) // .insert sans upsert échouera si duplicate key (si contrainte unique existe), ou ajoutera.
               // Idéalement on utilise upsert avec ignoreDuplicates si on a une contrainte unique sur URL.
               // Ici on suppose qu'on veut éviter les doublons de crawl en attente.
          
          if (!queueError) addedCount++;
        } catch (err) {}
      }
      if (addedCount > 0) {
        await logToDb(queueId, `Added ${addedCount} new pages to queue`, 'DISCOVERY', 'success');
      }
    }

    await logToDb(queueId, 'Page indexed successfully', 'COMPLETE', 'success');

    // Mise à jour des stats
    try {
      await supabase.rpc('increment_crawl_stats')
    } catch (e) {}

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[CRAWL ERROR]', error)
    await logToDb(queueId, `Error: ${error.message}`, 'ERROR', 'error');

    // Nettoyage si échec
    if (currentUrl && cryptoService) {
      try {
        const encryptedUrlToDelete = await cryptoService.encrypt(currentUrl, true);
        await supabase.from('crawled_pages').delete().eq('url', encryptedUrlToDelete);
      } catch (e) {}
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})