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

    const promptMap: { [key: string]: string } = {};
    if (configs) {
        for (const row of configs) {
            promptMap[row.key] = row.value;
        }
    }

    // 2. OBTENER CONOCIMIENTO ADICIONAL (Base de Conocimiento y Media)
    const { data: knowledgeDocs } = await supabaseClient
      .from('knowledge_documents')
      .select('title, description, content, category')
      .limit(20);

    const knowledgeBlock = knowledgeDocs?.map(k => 
      `[RECURSO: ${k.title} | CATEGORÍA: ${k.category}]\n` +
      `INSTRUCCIÓN DE USO: ${k.description || 'No especificada'}\n` +
      `CONTENIDO: ${k.content || 'No especificado'}`
    ).join('\n\n') || "No hay documentos adicionales en la base de conocimiento.";

    const { data: mediaAssets } = await supabaseClient
      .from('media_assets')
      .select('title, ai_instructions')
      .not('ai_instructions', 'is', null)
      .limit(10);

    const mediaBlock = mediaAssets?.map(m => 
      `[MEDIA: ${m.title}]\n` +
      `INSTRUCCIONES: ${m.ai_instructions}`
    ).join('\n\n') || "No hay assets de media con instrucciones.";

    // 3. CONSTRUCCIÓN DEL CEREBRO DINÁMICO (SIN VERDAD MAESTRA)
    const systemPrompt = `
<INSTRUCTIONS>
${promptMap['prompt_adn_core'] ?? '# ADN CORE\nEres un asistente de ventas para The Elephant Bowl.'}

${promptMap['prompt_estrategia_cierre'] ?? '# ESTRATEGIA DE CIERRE\nTu objetivo es cerrar la venta.'}

${promptMap['prompt_protocolos'] ?? '# PROTOCOLOS\nSigue las reglas de la empresa.'}
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
        version: "1.3.0-STABLE_BRAIN",
        has_truth: false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})