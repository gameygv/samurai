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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { message, lead_id, mode = 'LIVE' } = await req.json();

    const { data: configData } = await supabaseClient
        .from('app_config')
        .select('key, value')
        .eq('category', 'PROMPT');
    
    const prompts: any = {};
    configData?.forEach(i => prompts[i.key] = i.value);

    let leadContext = "Nombre: Prospecto Anónimo\nUbicación: Desconocida";
    if (lead_id) {
        const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
        if (lead) {
            leadContext = `
NOMBRE DEL CLIENTE: ${lead.nombre || 'Desconocido'}
CIUDAD/UBICACIÓN: ${lead.ciudad || 'No especificada'}
INTENCIÓN DE COMPRA ACTUAL: ${lead.buying_intent || 'BAJA'}
PERFIL PSICOLÓGICO DETECTADO: ${lead.perfil_psicologico || 'En análisis...'}
RESUMEN DE MEMORIA (Lo que ya sabemos): ${lead.summary || 'Sin historial previo.'}
ESTADO EMOCIONAL: ${lead.estado_emocional_actual || 'NEUTRO'}
            `;
        }
    }

    const { data: mainWebsiteData } = await supabaseClient
        .from('main_website_content')
        .select('url, title, content')
        .eq('scrape_status', 'success');

    let mainWebsiteContext = "";
    if (mainWebsiteData && mainWebsiteData.length > 0) {
        mainWebsiteContext = "\n=== 📚 FUENTE DE VERDAD: SITIO PRINCIPAL (theelephantbowl.com) ===\n";
        mainWebsiteData.forEach(page => {
            mainWebsiteContext += `\n[${page.title} - ${page.url}]\n${page.content.substring(0, 1000)}\n`;
        });
    }

    const { data: knowledgeDocs } = await supabaseClient
        .from('knowledge_documents')
        .select('title, content, type, category');

    let knowledgeContext = "";
    if (knowledgeDocs && knowledgeDocs.length > 0) {
        knowledgeContext = "\n=== 📖 RECURSOS ADICIONALES (Talleres/Maestros/Manuales) ===\n";
        knowledgeDocs.forEach(doc => {
            knowledgeContext += `\n[${doc.category}: ${doc.title}]\n${doc.content?.substring(0, 800) || 'Sin contenido indexado.'}\n`;
        });
    }

    const fullSystemPrompt = `
${prompts['prompt_adn_core'] || '# ADN CORE\nEres Samurai, un cerrador de elite.'}

=== 🛡️ REGLAS TÉCNICAS Y FORMATO ===
${prompts['prompt_tecnico'] || 'Responde siempre en texto plano.'}

=== 📜 PROTOCOLOS DE ATENCIÓN ===
${prompts['prompt_protocolos'] || ''}

=== 🤺 MATRIZ DE OBJECIONES ===
${prompts['prompt_objeciones'] || ''}

=== 📊 CONTEXTO DEL NEGOCIO (SITIO WEB Y DOCUMENTOS) ===
${mainWebsiteContext}
${knowledgeContext}

=== 🧩 PERFILADO Y PSICOLOGÍA ===
${prompts['prompt_perfilado'] || ''}
${prompts['prompt_tono'] || ''}
${prompts['prompt_estrategia_cierre'] || ''}

=== 🔄 MEMORIA Y RE-APRENDIZAJE (#CIA) ===
${prompts['prompt_reaprendizaje'] || ''}
${prompts['prompt_memoria'] || ''}
${prompts['prompt_trigger_corregiria'] || ''}

=== 📸 VISIÓN Y VALIDACIÓN DE PAGOS ===
${prompts['prompt_ojo_halcon'] || ''}
${prompts['prompt_match'] || ''}
${prompts['prompt_accion_post'] || ''}

=== 👤 CLIENTE ACTUAL ===
${leadContext}

=== ⚡ INSTRUCCIÓN DE SALIDA CRÍTICA (MANDATORIO) ===
1. Responde al cliente de forma DIRECTA, HUMANA y en TEXTO PLANO. 
2. NO envíes un objeto JSON completo.
3. Al FINAL de tu mensaje humano, añade OBLIGATORIAMENTE el bloque de análisis del sistema separado por una línea de guiones, usando este formato exacto:

---SYSTEM_ANALYSIS---
{
  "mood": "FELIZ|NEUTRO|ENOJADO",
  "intent": "ALTO|MEDIO|BAJO",
  "summary": "Resumen actualizado de la situación",
  "handoff_required": false
}
    `;

    return new Response(
      JSON.stringify({ 
        system_prompt: fullSystemPrompt,
        message_received: message,
        status: "ready"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})