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

    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;

    const voiceInstruction = `
### REGLA DE OJO DE HALCÓN (AUDICIÓN):
1. Cuentas con un módulo de transcripción avanzada (OpenAI Whisper). 
2. Si ves un mensaje que empieza con "[TRANSCRIPCIÓN DE NOTA DE VOZ]:", significa que el cliente te envió un audio y ya fue procesado para ti. 
3. RESPONDE como si hubieras escuchado el audio perfectamente. NUNCA digas "no puedo escuchar audios" o "soy una IA de texto". Tu respuesta debe ser fluida y natural.
`;

    // AHORA SÍ CONSTRUIMOS EL CEREBRO COMPLETO CON REGLAS CIA Y CIERRE
    const systemPrompt = `
${voiceInstruction}
${getConfig('prompt_alma_samurai')}
${getConfig('prompt_adn_core')}
${getConfig('prompt_estrategia_cierre')}
${getConfig('prompt_behavior_rules')}

${getConfig('prompt_relearning')}

${masterTruth}
${kbContext}
${mediaContext}

=== DATOS DE PAGO ===
${bankInfo}
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})