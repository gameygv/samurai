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

    const truthBlock = masterTruth?.map(k => `[WEB: ${k.title}]\n${k.content?.substring(0, 1200)}`).join('\n\n') || "Sin datos de web.";

    // 3. Obtener BASE DE CONOCIMIENTO (Documentos)
    const { data: knowledgeDocs } = await supabaseClient
      .from('knowledge_documents')
      .select('title, category, content')
      .not('content', 'is', null)
      .limit(5);

    const knowledgeBlock = knowledgeDocs?.map(d => `[DOC: ${d.title} (${d.category})]\n${d.content?.substring(0, 1000)}`).join('\n\n') || "Sin documentos adicionales.";

    // 4. Obtener POSTERS / MEDIA (Ojo de Halcón)
    const { data: mediaAssets } = await supabaseClient
      .from('media_assets')
      .select('title, ai_instructions')
      .ilike('ai_instructions', '%OCR DATA%')
      .limit(5);

    const visualBlock = mediaAssets?.map(m => {
       const ocrText = m.ai_instructions?.split('--- OCR DATA ---')[1]?.trim() || "";
       return `[POSTER: ${m.title}]\nDATOS DETECTADOS: ${ocrText}`;
    }).join('\n\n') || "Sin posters analizados.";

    // 5. CONSTRUCCIÓN POR PRIORIDADES
    const systemPrompt = `
      # NIVEL 1: CEREBRO CORE (IDENTIDAD MAESTRA)
      ${promptMap['prompt_adn_core'] || 'Eres Samurai, experto de The Elephant Bowl.'}
      ${promptMap['prompt_protocolos'] || ''}

      # NIVEL 2: VERDAD MAESTRA (REALIDAD DEL SITIO WEB)
      IMPORTANTE: Si hay discrepancias, esta información de la web oficial manda sobre el conocimiento general:
      ${truthBlock}

      # NIVEL 3: BASE DE CONOCIMIENTO (MANUALES Y TALLERES)
      Información técnica y detallada de soporte:
      ${knowledgeBlock}

      # NIVEL 4: RADAR VISUAL (POSTERS E IMÁGENES)
      Usa estos datos si el cliente pregunta por un flyer, poster o información visual específica:
      ${visualBlock}

      # REGLAS DE DECISIÓN (PROTOCOLO DE RESPUESTA)
      1. Prioriza tu Identidad Core (Ventas/Cierre).
      2. Usa la Verdad Maestra para datos de talleres y servicios.
      3. Usa la Base de Conocimiento para profundidad técnica.
      4. Usa el Radar Visual para detalles de posters o promociones gráficas.
      5. SIEMPRE asume que somos los líderes. NUNCA digas "no sé" si la info está en los niveles 2, 3 o 4.
      
      # REGLAS APRENDIDAS (#CIA)
      ${promptMap['prompt_relearning'] || ''}
    `;

    return new Response(
      JSON.stringify({ 
        system_prompt: systemPrompt,
        version: "0.8.7-HIERARCHY",
        stats: {
          web_pages: masterTruth?.length || 0,
          docs: knowledgeDocs?.length || 0,
          visuals: mediaAssets?.length || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})