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

    // --- 1. DIRECTIVAS DE COMPORTAMIENTO (PRIORIDAD ALTA) ---
    const behaviorDirectives = `
### DIRECTIVAS CRÍTICAS DE OPERACIÓN:
1. NO SALUDES de nuevo si ya lo hiciste en el historial. No digas "¡Hola [Nombre]!" en cada mensaje.
2. NO REPITAS la ubicación del cliente como confirmación constante. Ya sabes de dónde es.
3. DATOS BANCARIOS: Usa EXCLUSIVAMENTE la información de la sección [DATOS DE PAGO]. Prohibido inventar terminaciones de cuenta o nombres de banco.
4. BREVEDAD: Mantén tus respuestas en menos de 3 párrafos.
5. NO USES palabras espirituales/mágicas (Chakras, Ángeles). Usa terminología de PSICOACÚSTICA.
`;

    // --- 2. ESTADO DE DATOS REAL DEL LEAD ---
    const missing = [];
    // Si el nombre contiene 'Nuevo Lead' o es nulo/vacío
    if (!lead.nombre || lead.nombre.toLowerCase().includes('nuevo')) missing.push("NOMBRE COMPLETO");
    if (!lead.ciudad || lead.ciudad.length < 3) missing.push("UBICACIÓN (Ciudad)");
    if (!lead.email || !lead.email.includes('@')) missing.push("EMAIL (Para enviarle info/comprobante)");
    
    let dataMission = `\n### MISIÓN DE CAPTURA DE DATOS (Fase 1):\n`;
    dataMission += `CANAL: ${platform}\n`;
    
    if (missing.length > 0) {
        dataMission += `OBJETIVO ACTUAL: Debes obtener sutilmente: ${missing.join(', ')}.\n`;
        if (missing.includes("EMAIL")) {
            dataMission += `ORDEN: El cliente ya dio su nombre/ciudad. Tu prioridad AHORA es pedir el EMAIL de forma persuasiva (ej: para mandarle el temario o asegurar su folio).\n`;
        }
    } else {
        dataMission += `OBJETIVO ACTUAL: Todos los datos capturados. Procede al CIERRE DE VENTA ($1500 MXN).\n`;
    }

    // --- 3. CARGAR CONTEXTO DINÁMICO ---
    const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    let masterTruth = "\n### VERDAD MAESTRA (SITIO WEB):\n";
    webPages?.forEach(p => { if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 1000)}\n`; });

    const { data: kbDocs } = await supabaseClient.from('knowledge_documents').select('title, category, content');
    let kbContext = "\n### CONOCIMIENTO TÉCNICO (PDFs):\n";
    kbDocs?.forEach(d => { if(d.content) kbContext += `\n[DOC: ${d.title}]\n${d.content.substring(0, 800)}\n`; });

    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER');
    let mediaContext = "\n### BÓVEDA VISUAL (POSTERS):\nUsa <<MEDIA:URL>> para enviar posters.\n";
    mediaAssets?.forEach(m => { mediaContext += `- ${m.title} (Trigger: ${m.ai_instructions}) -> <<MEDIA:${m.url}>>\n`; });

    const bankInfo = `
[DATOS DE PAGO OFICIALES]
BANCO: ${getConfig('bank_name')}
CUENTA: ${getConfig('bank_account')}
CLABE: ${getConfig('bank_clabe')}
TITULAR: ${getConfig('bank_holder')}
MONTO ANTICIPO: $1,500 MXN
`;
    
    // --- 4. ENSAMBLAJE DEL KERNEL ---
    const systemPrompt = `
${behaviorDirectives}

${getConfig('prompt_alma_samurai')}

${dataMission}

${getConfig('prompt_adn_core')}
${getConfig('prompt_estrategia_cierre')}
${getConfig('prompt_behavior_rules')}

${masterTruth}
${kbContext}
${mediaContext}

${bankInfo}
`.trim();

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})