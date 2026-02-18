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

  console.log("[scrape-main-website] Iniciando scraping del sitio principal...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Obtener todas las URLs pendientes o que necesitan actualización
    const { data: urls, error: fetchError } = await supabaseClient
      .from('main_website_content')
      .select('*')
      .order('last_scraped_at', { ascending: true });

    if (fetchError) throw fetchError;
    if (!urls || urls.length === 0) {
        return new Response(JSON.stringify({ message: "No URLs to scrape." }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    console.log(`[scrape-main-website] Found ${urls.length} URLs to process`);

    const results = [];

    // 2. Scrapear cada URL secuencialmente
    for (const page of urls) {
        try {
            console.log(`[scrape-main-website] Scraping: ${page.url}`);
            
            const response = await fetch(page.url, {
                headers: { 
                  'User-Agent': 'Mozilla/5.0 (compatible; SamuraiBot/1.0; +http://dyad.sh)',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // Extraer título
            const title = $('title').text() || $('h1').first().text() || page.url;

            // Limpieza agresiva
            $('script').remove();
            $('style').remove();
            $('noscript').remove();
            $('iframe').remove();
            $('svg').remove();
            $('header').remove();
            $('footer').remove();
            $('nav').remove();
            $('.cookie-notice').remove();
            $('.popup').remove();
            $('.modal').remove();

            // Extraer texto del body
            let text = $('body').text();
            
            // Limpiar espacios en blanco excesivos
            text = text.replace(/\s+/g, ' ').trim();
            
            // Limitar a 10,000 caracteres para evitar overflow
            const truncatedText = text.substring(0, 10000);

            // Actualizar en la base de datos
            const { error: updateError } = await supabaseClient
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

            if (updateError) throw updateError;

            results.push({ 
              url: page.url, 
              status: 'success', 
              title: title,
              length: truncatedText.length 
            });

            console.log(`[scrape-main-website] ✓ Success: ${page.url} (${truncatedText.length} chars)`);

            // Pequeña pausa para no saturar el servidor
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (err) {
            console.error(`[scrape-main-website] ✗ Error processing ${page.url}:`, err);
            
            // Registrar el error en la base de datos
            await supabaseClient
                .from('main_website_content')
                .update({ 
                    scrape_status: 'error',
                    error_message: err.message,
                    last_scraped_at: new Date().toISOString()
                })
                .eq('id', page.id);

            results.push({ 
              url: page.url, 
              status: 'error', 
              error: err.message 
            });
        }
    }

    // 3. Log de actividad global
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    await supabaseClient.from('activity_logs').insert({
        action: 'UPDATE',
        resource: 'BRAIN',
        description: `Scraping sitio principal completado: ${successCount}/${urls.length} páginas actualizadas.`,
        status: errorCount > 0 ? 'ERROR' : 'OK',
        metadata: { results, total: urls.length, success: successCount, errors: errorCount }
    });

    console.log(`[scrape-main-website] Completed: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        total: urls.length,
        successful: successCount,
        failed: errorCount,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("[scrape-main-website] Critical Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})