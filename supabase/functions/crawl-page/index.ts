import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
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

    // Récupérer le contenu de la page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DyadSearchBot/1.0 (Educational Project)',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    
    // Parser le HTML pour extraire les informations
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : 'Sans titre'

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    const description = descMatch ? descMatch[1].trim() : ''

    // Extraire le contenu textuel (enlever les balises HTML)
    let content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000) // Limiter à 5000 caractères

    // Extraire le domaine
    const urlObj = new URL(url)
    const domain = urlObj.hostname

    // Sauvegarder dans la base de données
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

    // Extraire les liens pour un crawling futur (si maxDepth > 0)
    if (maxDepth > 0) {
      const linkRegex = /<a[^>]*href=["']([^"']+)["']/gi
      const links: string[] = []
      let match

      while ((match = linkRegex.exec(html)) !== null) {
        try {
          const linkUrl = new URL(match[1], url)
          // Ne garder que les liens du même domaine
          if (linkUrl.hostname === domain && linkUrl.protocol.startsWith('http')) {
            links.push(linkUrl.href)
          }
        } catch (e) {
          // Ignorer les URLs invalides
        }
      }

      // Ajouter les liens à la queue (limiter à 10 pour éviter la surcharge)
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

    // Mettre à jour les statistiques
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