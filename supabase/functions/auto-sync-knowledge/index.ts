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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Obtener todos los sitios web activos
    const { data: websites, error: fetchError } = await supabaseClient
      .from('knowledge_documents')
      .select('id, title, external_link')
      .eq('type', 'WEBSITE');

    if (fetchError) throw fetchError;
    if (!websites || websites.length === 0) {
        return new Response(JSON.stringify({ message: "No websites to sync." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = [];

    // 2. Iterar y Scrapear (Secuencial para no saturar memoria)
    for (const site of websites) {
        try {
            console.log(`Syncing: ${site.title} (${site.external_link})`);
            
            const response = await fetch(site.external_link, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SamuraiBot/1.0; +http://dyad.sh)' }
            });

            if (!response.ok) {
                results.push({ id: site.id, status: 'error', error: `HTTP ${response.status}` });
                continue;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // Limpieza
            $('script').remove(); $('style').remove(); $('noscript').remove(); 
            $('iframe').remove(); $('svg').remove(); $('header').remove(); $('footer').remove();

            let text = $('body').text();
            text = text.replace(/\s+/g, ' ').trim();
            const truncatedText = text.substring(0, 5000);

            // Actualizar DB
            await supabaseClient
                .from('knowledge_documents')
                .update({ 
                    content: truncatedText,
                    updated_at: new Date().toISOString()
                })
                .eq('id', site.id);

            results.push({ id: site.id, title: site.title, status: 'ok', length: truncatedText.length });

        } catch (err) {
            console.error(`Error processing ${site.title}:`, err);
            results.push({ id: site.id, title: site.title, status: 'error', error: err.message });
        }
    }

    // 3. Log Global de la operación
    await supabaseClient.from('activity_logs').insert({
        action: 'UPDATE',
        resource: 'BRAIN',
        description: `Auto-Sync completado: ${results.filter(r => r.status === 'ok').length}/${websites.length} sitios actualizados.`,
        status: 'OK',
        metadata: { results }
    });

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("Auto-Sync Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})