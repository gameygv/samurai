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

    // --- 1. ESTADO DE DATOS DEL LEAD ---
    const missing = [];
    if (!lead.nombre || lead.nombre.includes('Nuevo')) missing.push("NOMBRE REAL");
    if (!lead.email) missing.push("EMAIL (Para enviarle su pase/info)");
    if (!lead.ciudad) missing.push("UBICACIÓN (Para ver disponibilidad en su zona)");
    
    let dataStatus = `\n=== ESTADO DE CAPTURA DE DATOS ===\n`;
    dataStatus += `PLATAFORMA ACTUAL: ${platform}\n`;
    if (platform === 'WHATSAPP') {
        dataStatus += `- TELÉFONO: YA LO TIENES (${lead.telefono}). PROHIBIDO PREGUNTARLO.\n`;
    }
    if (missing.length > 0) {
        dataStatus += `- DATOS PENDIENTES: ${missing.join(', ')}.\n`;
        dataStatus += `INSTRUCCIÓN: No los pidas como un formulario. Intégralos en la charla. Ej: "Para ver si tenemos cupo en tu ciudad, ¿desde dónde nos escribes?" o "Pásame tu correo para mandarte el PDF del taller".\n`;
    } else {
        dataStatus += `- TODO CAPTURADO: Procede al cierre de venta.\n`;
    }

    // --- 2. PROTOCOLO PSICOGRÁFICO ---
    const psychProtocol = `
\n=== PROTOCOLO DE PERFILAMIENTO PSICOGRÁFICO ===
Tu objetivo es entender QUIÉN es el cliente usando la información de la [BASE DE CONOCIMIENTO].
1. Identifica su "Dolor": ¿Busca sanación, curiosidad técnica o es terapeuta?
2. Usa preguntas abiertas: "¿Qué te llamó la atención de los cuencos?" o "¿Ya tienes experiencia en meditación?".
3. Adapta tu tono: Si es profesional, sé técnico. Si es principiante, sé inspirador.
`;

    // --- 3. CARGAR RECURSOS (WEB, KB, MEDIA) ---
    // (Mantenemos la carga de Verdad Maestra, KB y Media Assets igual que antes)
    const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    let masterTruth = "\n=== VERDAD MAESTRA (SITIO WEB) ===\n";
    webPages?.forEach(p => { if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 1500)}\n`; });

    const { data: kbDocs } = await supabaseClient.from('knowledge_documents').select('title, category, content');
    let kbContext = "\n=== CONOCIMIENTO TÉCNICO (PDFs/NOTAS) ===\n";
    kbDocs?.forEach(d => { if(d.content) kbContext += `\n[RECURSO: ${d.title}]\n${d.content.substring(0, 1000)}\n`; });

    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER');
    let mediaContext = "\n=== BÓVEDA VISUAL (POSTERS) ===\nUsa <<MEDIA:URL>> para enviar posters según la ciudad o interés.\n";
    mediaAssets?.forEach(m => { mediaContext += `- ${m.title}: ${m.ai_instructions} -> <<MEDIA:${m.url}>>\n`; });

    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;
    
    const systemPrompt = `
${getConfig('prompt_alma_samurai')}
${getConfig('prompt_adn_core')}
${getConfig('prompt_estrategia_cierre')}

${dataStatus}
${psychProtocol}
${getConfig('prompt_behavior_rules')}
${getConfig('prompt_human_handoff')}

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