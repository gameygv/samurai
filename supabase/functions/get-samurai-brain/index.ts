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

    // 1. Obtener PROMPTS (Cerebro Core)
    const { data: configs } = await supabaseClient
      .from('app_config')
      .select('key, value')
      .eq('category', 'PROMPT');

    const promptMap = configs?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}) || {};

    // 2. Obtener VERDAD MAESTRA (Sitio Web)
    const { data: masterTruth } = await supabaseClient
      .from('main_website_content')
      .select('title, content')
      .eq('scrape_status', 'success')
      .limit(15);

    const hasTruth = masterTruth && masterTruth.length > 0;
    const truthBlock = masterTruth?.map(k => `[FUENTE OFICIAL: ${k.title}]\n${k.content?.substring(0, 1500)}`).join('\n\n') || "ATENCIÓN: NO HAY DATOS DE LA WEB INDEXADOS.";

    // 3. Obtener BASE DE CONOCIMIENTO (Documentos)
    const { data: knowledgeDocs } = await supabaseClient
      .from('knowledge_documents')
      .select('title, category, content')
      .not('content', 'is', null)
      .limit(5);

    const knowledgeBlock = knowledgeDocs?.map(d => `[DOCUMENTO TÉCNICO: ${d.title}]\n${d.content?.substring(0, 1000)}`).join('\n\n') || "";

    // 4. Obtener POSTERS / MEDIA
    const { data: mediaAssets } = await supabaseClient
      .from('media_assets')
      .select('title, ai_instructions')
      .ilike('ai_instructions', '%OCR DATA%')
      .limit(5);

    const visualBlock = mediaAssets?.map(m => {
       const ocrText = m.ai_instructions?.split('--- OCR DATA ---')[1]?.trim() || "";
       return `[POSTER ANALIZADO: ${m.title}]\nDATOS REALES: ${ocrText}`;
    }).join('\n\n') || "";

    // 5. CONSTRUCCIÓN CON BLOQUEO ANTI-ALUCINACIÓN
    const systemPrompt = `
      # REGLA DE ORO (MUNDO CERRADO)
      Eres Samurai de "The Elephant Bowl". Tu conocimiento es LIMITADO. 
      SOLO existes para hablar de Sonoterapia, Cuencos, Gongs y formaciones de nuestra marca.
      PROHIBIDO: Hablar de talleres de cocina, arte, mecánica o cualquier cosa no listada en tus fuentes.
      PROHIBIDO: Inventar servicios o ubicaciones que no estén explícitamente en la VERDAD MAESTRA.

      # NIVEL 1: ADN CORE
      ${promptMap['prompt_adn_core'] || 'Eres el cerrador de ventas de elite.'}
      ${promptMap['prompt_estrategia_cierre'] || ''}
      ${promptMap['prompt_protocolos'] || ''}

      # NIVEL 2: VERDAD MAESTRA (LA ÚNICA REALIDAD PERMITIDA)
      Usa esta información como única fuente de verdad para servicios y productos:
      ${truthBlock}

      # NIVEL 3: SOPORTE TÉCNICO
      ${knowledgeBlock}

      # NIVEL 4: DATOS VISUALES
      ${visualBlock}

      # INSTRUCCIONES DE SEGURIDAD CRÍTICA
      1. Si el cliente pregunta por algo que NO está en los niveles anteriores (ej. talleres de otra cosa): 
         RESPUESTA: "En The Elephant Bowl nos especializamos exclusivamente en Sonoterapia y formación profesional. No cuento con información sobre ese tipo de talleres externos."
      2. NUNCA menciones que eres una IA o que tienes "niveles de conocimiento".
      3. Mantén siempre el enfoque en llevar al cliente a la compra del anticipo de $1500 MXN.
      
      # APRENDIZAJE RECIENTE (#CIA)
      ${promptMap['prompt_relearning'] || ''}
    `;

    return new Response(
      JSON.stringify({ 
        system_prompt: systemPrompt,
        version: "0.9.0-HARD-LOCK",
        is_safe: hasTruth
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})