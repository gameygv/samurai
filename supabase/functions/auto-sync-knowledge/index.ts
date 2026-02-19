import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { cheerio } from 'https://deno.land/x/cheerio@1.0.7/mod.ts'

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log("[auto-sync-knowledge] Iniciando proceso de sincronización de conocimiento...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: websites, error: fetchError } = await supabaseClient
      .from('knowledge_documents')
      .select('id, title, external_link')
      .eq('type', 'WEBSITE')
      .not('external_link', 'is', null);

    if (fetchError) throw fetchError;
    if (!websites || websites.length === 0) {
        return new Response(JSON.stringify({ message: "No hay sitios web en la base de conocimiento para sincronizar." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results = [];

    for (const site of websites) {
        try {
            if (!site.external_link) continue;
            console.log(`[auto-sync-knowledge] Sincronizando: ${site.title} (${site.external_link})`);
            
            const response = await fetch(site.external_link, {
                headers: { 'User-Agent': BROWSER_USER_AGENT }
            });

            if (!response.ok) {
                results.push({ id: site.id, status: 'error', error: `HTTP ${response.status}` });
                continue;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            $('script, style, nav, footer, header').remove();
            let text = $('body').text().replace(/\s\s+/g, ' ').trim();
            const truncatedText = text.substring(0, 5000);

            await supabaseClient
                .from('knowledge_documents')
                .update({ 
                    content: truncatedText,
                    updated_at: new Date().toISOString()
                })
                .eq('id', site.id);

            results.push({ id: site.id, title: site.title, status: 'ok', length: truncatedText.length });

        } catch (err) {
            console.error(`[auto-sync-knowledge] Error procesando ${site.title}:`, err);
            results.push({ id: site.id, title: site.title, status: 'error', error: err.message });
        }
    }

    await supabaseClient.from('activity_logs').insert({
        action: 'UPDATE',
        resource: 'BRAIN',
        description: `Sincronización de conocimiento: ${results.filter(r => r.status === 'ok').length}/${websites.length} sitios actualizados.`,
        status: 'OK',
        metadata: { results }
    });

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("[auto-sync-knowledge] Error crítico:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})