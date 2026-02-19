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

    // 2. OBTENER CONOCIMIENTO ADICIONAL (Base de Conocimiento y Media)
    // Se omite la "Verdad Maestra" (main_website_content) temporalmente.

    // Fetch from Knowledge Base
    const { data: knowledgeDocs } = await supabaseClient
      .from('knowledge_documents')
      .select('title, description, content, category')
      .limit(20);

    const knowledgeBlock = knowledgeDocs?.map(k => 
      `[RECURSO: ${k.title} | CATEGORÍA: ${k.category}]\n` +
      `INSTRUCCIÓN DE USO: ${k.description || 'No especificada'}\n` +
      `CONTENIDO: ${k.content || 'No especificado'}`
    ).join('\n\n') || "No hay documentos adicionales en la base de conocimiento.";

    // Fetch from Media Manager
    const { data: mediaAssets } = await supabaseClient
      .from('media_assets')
      .select('title, ai_instructions')
      .not('ai_instructions', 'is', null)
      .limit(10);

    const mediaBlock = mediaAssets?.map(m => 
      `[MEDIA: ${m.title}]\n` +
      `INSTRUCCIONES: ${m.ai_instructions}`
    ).join('\n\n') || "No hay assets de media con instrucciones.";

    // 3. CONSTRUCCIÓN DEL CEREBRO TEMPORAL (SIN VERDAD MAESTRA)
    const systemPrompt = `
<INSTRUCTIONS>
# TU IDENTIDAD
- Tu nombre es Sam. Eres un asesor experto y el único punto de contacto para The Elephant Bowl.
- Preséntate SIEMPRE como "Hola, soy Sam de The Elephant Bowl, ¿cómo puedo ayudarte?".
- Tu única misión es guiar a los clientes para que se inscriban en formaciones o compren instrumentos, utilizando la información del CONTEXTO.

# REGLAS DE COMUNICACIÓN
- Sé amable, profesional y directo.
- NUNCA menciones que eres una IA.
- NUNCA ofrezcas información sobre temas no relacionados con The Elephant Bowl.
- Si no encuentras la respuesta en el CONTEXTO, di: "No tengo esa información en este momento, pero puedo ayudarte con nuestros talleres de sonoterapia y cuencos de cuarzo."

# PROCESO DE VENTA
- Tu objetivo final es que el cliente pague el anticipo de $1500 MXN.
- Guía la conversación hacia la venta, resolviendo dudas con la información del CONTEXTO.
- ${promptMap['prompt_estrategia_cierre'] || ''}
- ${promptMap['prompt_protocolos'] || ''}
</INSTRUCTIONS>

<CONTEXT>
# BASE DE CONOCIMIENTO ADICIONAL
${knowledgeBlock}

# MEDIA MANAGER (IMÁGENES Y POSTERS)
${mediaBlock}
</CONTEXT>
    `;

    return new Response(
      JSON.stringify({ 
        system_prompt: systemPrompt,
        version: "1.1.0-TEMPORARY_BRAIN",
        has_truth: false // Explícitamente desactivado
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})