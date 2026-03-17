// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const body = await req.json().catch(() => ({}));
    const lead = body.lead || {};
    const platform = body.platform || 'WHATSAPP';

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string, def = "") => configs?.find((c: any) => c.key === key)?.value || def;

    // --- CARGAR VERDAD MAESTRA ---
    const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    let masterTruth = "\n=== VERDAD MAESTRA (SITIO WEB) ===\n";
    webPages?.forEach(p => { if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 1500)}\n`; });

    // --- CARGAR BASE DE CONOCIMIENTO ---
    const { data: kbDocs } = await supabaseClient.from('knowledge_documents').select('title, category, content');
    let kbContext = "\n=== CONOCIMIENTO TÉCNICO (PDFs/NOTAS) ===\n";
    kbDocs?.forEach(d => { if(d.content) kbContext += `\n[RECURSO: ${d.title}]\n${d.content.substring(0, 1000)}\n`; });

    // --- CARGAR BÓVEDA VISUAL (POSTERS) ---
    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER');
    let mediaContext = "\n=== BÓVEDA VISUAL (POSTERS) ===\nINSTRUCCIÓN CRÍTICA: Para enviar un poster usa EXACTAMENTE este formato en tu respuesta: <<MEDIA:url_del_poster>>\n";
    mediaAssets?.forEach(m => { mediaContext += `- ${m.title}: ${m.ai_instructions} -> <<MEDIA:${m.url}>>\n`; });

    // --- REGLAS PSICOGRÁFICAS ---
    const psychStrategy = `
### ESTRATEGIA DE PERFILAMIENTO PSICOGRÁFICO:
1. Si el cliente pregunta por el sonido, menciona la "Psicoacústica" y pregunta: "¿Te interesa para uso personal o para integrarlo en alguna terapia que ya realices?"
2. Usa datos del Cerebro Core para demostrar autoridad.
3. REGLA WHATSAPP: Estás en ${platform}. Ya tienes su teléfono (${lead.telefono || 'Desconocido'}). NO lo pidas.
`;

    // --- CARGA DE DATOS BANCARIOS ---
    const bankData = `
### [DATOS DE PAGO - VERDAD ABSOLUTA]
Banco: ${getConfig('bank_name')}
Cuenta: ${getConfig('bank_account')}
CLABE: ${getConfig('bank_clabe')}
Titular: ${getConfig('bank_holder')}
`;

    const systemPrompt = `
${psychStrategy}
${getConfig('prompt_alma_samurai')}
${getConfig('prompt_adn_core')}
${getConfig('prompt_behavior_rules')}

${masterTruth}
${kbContext}
${mediaContext}
${bankData}
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})