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

  async decrypt(encryptedText: string): Promise<string> {
    if (!this.key) throw new Error('Crypto not initialized');
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.key, data);
    return new TextDecoder().decode(decrypted);
  }

  async hash(text: string): Promise<string> {
    const data = encoder.encode(text.toLowerCase());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

function isAllowedLanguage(html: string): boolean {
  // 1. Check HTML lang attribute
  const langMatch = html.match(/<html[^>]+lang=["']([a-zA-Z\-]+)["'][^>]*>/i);
  if (langMatch) {
    const lang = langMatch[1].toLowerCase();
    if (lang.startsWith('fr') || lang.startsWith('en')) return true;
    return false; // Explicitly other language
  }

  // 2. Fallback: Check common words if no lang attribute
  const textSample = html.substring(0, 2000).toLowerCase();
  const frWords = ['le', 'la', 'et', 'est', 'pour', 'dans', 'avec'];
  const enWords = ['the', 'and', 'is', 'for', 'with', 'that', 'this'];

  const frCount = frWords.filter(w => textSample.includes(` ${w} `)).length;
  const enCount = enWords.filter(w => textSample.includes(` ${w} `)).length;

  return frCount > 2 || enCount > 2;
}

function extractMetadata(html: string): { title: string, description: string, content: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Sans titre';

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
    content: content.substring(0, 5000)
  };
}

function calculatePriority(url: string, text: string): number {
  const lowerUrl = url.toLowerCase();
  const lowerText = text.toLowerCase();
  let score = 5; // Base score

  // Boost content pages
  if (lowerUrl.includes('/blog/') || lowerUrl.includes('/article/')) score += 3;
  if (lowerUrl.includes('/product/') || lowerUrl.includes('/item/')) score += 2;
  if (lowerUrl.includes('about') || lowerUrl.includes('propos')) score += 2;
  
  // Penalty for noise
  if (lowerUrl.includes('/tag/')) score -= 2;
  if (lowerUrl.includes('/category/')) score -= 1;
  if (lowerUrl.includes('/archive/')) score -= 3;
  if (lowerUrl.includes('/page/')) score -= 2;
  if (lowerUrl.includes('?')) score -= 1; // Query params often duplicate
  
  // Text relevance
  if (lowerText.length > 40) score += 1;
  
  return Math.max(0, Math.min(score, 10));
}

function extractLinks(html: string, baseUrl: string): { url: string, priority: number }[] {
  const links: { url: string, priority: number }[] = [];
  const regex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  let match;
  
  // Normalize base domain to strict hostname
  const baseObj = new URL(baseUrl);
  const baseHostname = baseObj.hostname.replace(/^www\./, '');

  while ((match = regex.exec(html)) !== null) {
    try {
      const href = match[1];
      const text = match[2].replace(/<[^>]+>/g, '').trim();
      
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || !text) continue;
      if (text.length < 2) continue;

      const absoluteUrl = new URL(href, baseUrl);
      const currentHostname = absoluteUrl.hostname.replace(/^www\./, '');

      // STRICT DOMAIN CHECK: Must match base hostname exactly (no subdomains unless base was subdomain)
      if (currentHostname !== baseHostname) {
        continue;
      }
      
      // Ignore static files
      if (absoluteUrl.pathname.match(/\.(jpg|jpeg|png|gif|pdf|zip|css|js|json|xml)$/i)) {
        continue;
      }

      // Ignore login/signup/cart
      if (absoluteUrl.pathname.match(/(login|signin|signup|register|cart|checkout|account)/i)) {
        continue;
      }

      if (!links.some(l => l.url === absoluteUrl.href)) {
        const priority = calculatePriority(absoluteUrl.href, text);
        // Only add if priority is decent (>3)
        if (priority > 3) {
           links.push({ url: absoluteUrl.href, priority });
        }
      }
    } catch (e) { continue; }
  }
  return links.slice(0, 20); // Hard limit 20 links per page
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

    // 0. DOMAIN LIMIT CHECK
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const encryptedDomain = await cryptoService.encrypt(domain);
    
    // Check how many pages we already have for this domain
    const { count } = await supabase
      .from('crawled_pages')
      .select('*', { count: 'exact', head: true })
      .eq('domain', encryptedDomain);

    // STRICT LIMIT: 10 PAGES MAX
    if (count && count >= 10) {
      await logToDb(queueId, `Domain limit reached (10 pages) for ${domain}. Skipping.`, 'LIMIT', 'warning');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'limit_reached' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await logToDb(queueId, `Crawling: ${url}`, 'INIT', 'info');

    // 1. Fetching
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; SivaraBot/1.0; +http://sivara.search)',
        'Accept': 'text/html',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
      },
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    // Content-Type check
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      throw new Error('Not an HTML page');
    }

    const rawHtml = await response.text();

    // 2. Language Check
    if (!isAllowedLanguage(rawHtml)) {
       throw new Error('Language not supported (Not FR/EN)');
    }

    await logToDb(queueId, `Parsing SEO data...`, 'PARSING', 'info');
    
    // 3. Parsing
    const metadata = extractMetadata(rawHtml);
    const discoveredLinks = extractLinks(rawHtml, url);

    await logToDb(queueId, `Found: "${metadata.title}" & ${discoveredLinks.length} valid links`, 'PARSING', 'success');

    // 4. Encryption & Save
    await logToDb(queueId, 'Encrypting data...', 'ENCRYPTION', 'info');

    const encryptedTitle = await cryptoService.encrypt(metadata.title)
    const encryptedDescription = await cryptoService.encrypt(metadata.description)
    const encryptedContent = await cryptoService.encrypt(metadata.content)
    const encryptedUrl = await cryptoService.encrypt(url, true)
    
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

    // 5. Add new links to queue
    // STOP adding new links if we are close to the limit (8 pages)
    if (discoveredLinks.length > 0 && (!count || count < 8)) { 
      let addedCount = 0;
      for (const link of discoveredLinks) {
        try {
          const linkEncrypted = await cryptoService.encrypt(link.url, true);
          
          // Check if already crawled
          const { data: existing } = await supabase
            .from('crawled_pages')
            .select('id')
            .eq('url', linkEncrypted)
            .single();
            
          if (!existing) {
             const { error: queueError } = await supabase.from('crawl_queue')
              .insert({
                url: linkEncrypted,
                priority: link.priority,
                status: 'pending'
              });
             if (!queueError) addedCount++;
          }
        } catch (err) {}
      }
      if (addedCount > 0) {
        await logToDb(queueId, `Queued ${addedCount} new pages`, 'DISCOVERY', 'success');
      }
    }

    await logToDb(queueId, 'Page indexed successfully', 'COMPLETE', 'success');

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