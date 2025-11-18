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
const decoder = new TextDecoder();

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

function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&eacute;': 'é',
    '&egrave;': 'è',
    '&ecirc;': 'ê',
    '&agrave;': 'à',
    '&acirc;': 'â',
    '&ocirc;': 'ô',
    '&ucirc;': 'û',
    '&ccedil;': 'ç',
    '&iuml;': 'ï',
    '&euml;': 'ë',
  };
  
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(dec);
  });
  
  decoded = decoded.replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  return decoded;
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
    
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY not configured')
    }

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

    console.log(`[SECURE CRAWL] Starting encrypted crawl for: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SivaraBot/1.0 (Government Security Demo)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept-Charset': 'utf-8',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()
    const textDecoder = new TextDecoder('utf-8')
    const html = textDecoder.decode(buffer)
    
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    let title = titleMatch ? titleMatch[1].trim() : 'Sans titre'
    title = decodeHtmlEntities(title)

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    let description = descMatch ? descMatch[1].trim() : ''
    description = decodeHtmlEntities(description)

    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000)
    
    content = decodeHtmlEntities(content)

    const urlObj = new URL(url)
    const domain = urlObj.hostname

    console.log(`[ENCRYPTION] Encrypting data with AES-256-GCM...`)
    
    // Cryptage militaire de toutes les données sensibles
    const encryptedTitle = await cryptoService.encrypt(title)
    const encryptedDescription = await cryptoService.encrypt(description)
    const encryptedContent = await cryptoService.encrypt(content)
    const encryptedUrl = await cryptoService.encrypt(url)
    const encryptedDomain = await cryptoService.encrypt(domain)
    
    // Création de hash pour la recherche (sans révéler le contenu)
    const searchHash = await cryptoService.hash(title + ' ' + description + ' ' + content)
    
    console.log(`[ENCRYPTION] Data encrypted successfully`)

    const { data, error } = await supabase
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
      .select()

    if (error) {
      console.error('[DATABASE ERROR]', error)
      throw error
    }

    console.log(`[SUCCESS] Encrypted data stored securely`)

    if (maxDepth > 0) {
      const linkRegex = /<a[^>]*href=["']([^"']+)["']/gi
      const links: string[] = []
      let match

      while ((match = linkRegex.exec(html)) !== null) {
        try {
          const linkUrl = new URL(match[1], url)
          if (linkUrl.hostname === domain && linkUrl.protocol.startsWith('http')) {
            links.push(linkUrl.href)
          }
        } catch (e) {
          // Ignorer les URLs invalides
        }
      }

      const uniqueLinks = [...new Set(links)].slice(0, 10)
      
      for (const link of uniqueLinks) {
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

      console.log(`[QUEUE] Added ${uniqueLinks.length} encrypted links to queue`)
    }

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
        message: 'Data encrypted and stored with military-grade security',
        encryption: 'AES-256-GCM',
        url: '[ENCRYPTED]',
        title: '[ENCRYPTED]',
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