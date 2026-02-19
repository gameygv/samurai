import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[scrape-main-website] Iniciando scraping optimizado...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Obtener URLs limitando a 5 por lote para evitar timeouts de 60s
    const { data: urls, error: fetchError } = await supabaseClient
      .from('main_website_content')
      .select('*')
      .order('last_scraped_at', { ascending: true, nullsFirst: true })
      .limit(5);

    if (fetchError) throw fetchError;
    if (!urls || urls.length === 0) {
        return new Response(JSON.stringify({ message: "No URLs to scrape.", successful: 0 }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    const results = [];

    for (const page of urls) {
        try {
            console.log(`[scrape-main-website] Scraping: ${page.url}`);
            
            const response = await fetch(page.url, {
                headers: { 
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                signal: AbortSignal.timeout(15000) // Timeout de 15s por página
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const html = await response.text();
            const $ = cheerio.load(html);

            const title = $('title').text() || $('h1').first().text() || page.title;
            $('script, style, noscript, iframe, svg, header, footer, nav').remove();

            let text = $('body').text().replace(/\s+/g, ' ').trim();
            const truncatedText = text.substring(0, 10000);

            await supabaseClient
                .from('main_website_content')
                .update({ 
                    title: title,
                    content: truncatedText,
                    content_length: truncatedText.length,
                    last_scraped_at: new Date().toISOString(),
                    scrape_status: 'success',
                    error_message: null
                })
                .eq('id', page.id);

            results.push({ url: page.url, status: 'success' });

        } catch (err) {
            console.error(`[scrape-main-website] ✗ Error en ${page.url}:`, err.message);
            await supabaseClient
                .from('main_website_content')
                .update({ 
                    scrape_status: 'error',
                    error_message: err.message,
                    last_scraped_at: new Date().toISOString()
                })
                .eq('id', page.id);
            results.push({ url: page.url, status: 'error' });
        }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    return new Response(
      JSON.stringify({ success: true, successful: successCount, total: urls.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders })
  }
})