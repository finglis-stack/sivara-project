// @ts-ignore: Deno types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore: Deno types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Fonction pour décoder les entités HTML
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
  
  // Décoder les entités numériques (&#233; -> é)
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    return String.fromCharCode(dec);
  });
  
  // Décoder les entités hexadécimales (&#x00E9; -> é)
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { url, maxDepth = 1 } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Starting crawl for: ${url}`)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SivaraBot/1.0 (Educational Search Engine)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept-Charset': 'utf-8',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Lire le contenu en tant que ArrayBuffer puis le décoder en UTF-8
    const buffer = await response.arrayBuffer()
    const decoder = new TextDecoder('utf-8')
    const html = decoder.decode(buffer)
    
    // Extraire le titre
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    let title = titleMatch ? titleMatch[1].trim() : 'Sans titre'
    title = decodeHtmlEntities(title)

    // Extraire la description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    let description = descMatch ? descMatch[1].trim() : ''
    description = decodeHtmlEntities(description)

    // Extraire le contenu
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

    const { data, error } = await supabase
      .from('crawled_pages')
      .upsert({
        url,
        title,
        description,
        content,
        domain,
        http_status: response.status,
        status: 'success',
      }, {
        onConflict: 'url'
      })
      .select()

    if (error) {
      console.error('Database error:', error)
      throw error
    }

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
        await supabase
          .from('crawl_queue')
          .upsert({
            url: link,
            priority: maxDepth - 1,
            status: 'pending'
          }, {
            onConflict: 'url',
            ignoreDuplicates: true
          })
      }

      console.log(`Added ${uniqueLinks.length} links to queue`)
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
        url,
        title,
        linksFound: maxDepth > 0 ? 'Links added to queue' : 'No links extracted',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Crawl error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})