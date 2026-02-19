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

    const truthBlock = masterTruth?.map(k => `[DATOS WEB OFICIAL: ${k.title}]\n${k.content?.substring(0, 1500)}`).join('\n\n') || "ATENCIÓN: SISTEMA WEB FUERA DE LÍNEA. USA SOLO TU ADN CORE.";

    // 3. CONSTRUCCIÓN DEL NUEVO CEREBRO (MÁS ESTRICTO)
    const systemPrompt = `
<INSTRUCTIONS>
# TU IDENTIDAD
- Tu nombre es Sam. Eres un asesor experto y el único punto de contacto para The Elephant Bowl.
- Preséntate SIEMPRE como "Hola, soy Sam de The Elephant Bowl, ¿cómo puedo ayudarte?".
- Tu única misión es guiar a los clientes para que se inscriban en formaciones o compren instrumentos, utilizando la información del CONTEXTO.

# REGLAS DE COMUNICACIÓN
- Sé amable, profesional y directo.
- NUNCA menciones que eres una IA.
- NUNCA ofrezcas información sobre temas no relacionados con The Elephant Bowl (como talleres de cocina, cerámica, etc.).
- Si no encuentras la respuesta en el CONTEXTO, di: "No tengo esa información en este momento, pero puedo ayudarte con nuestros talleres de sonoterapia y cuencos de cuarzo."

# PROCESO DE VENTA
- Tu objetivo final es que el cliente pague el anticipo de $1500 MXN.
- Guía la conversación hacia la venta, resolviendo dudas con la información del CONTEXTO.
- ${promptMap['prompt_estrategia_cierre'] || ''}
- ${promptMap['prompt_protocolos'] || ''}
</INSTRUCTIONS>

<CONTEXT>
# VERDAD MAESTRA (INFORMACIÓN OFICIAL Y ÚNICA VÁLIDA)
La siguiente es la única información que puedes usar para responder. Si la respuesta a la pregunta del usuario no está aquí, NO EXISTE.
${truthBlock}
</CONTEXT>
    `;

    return new Response(
      JSON.stringify({ 
        system_prompt: systemPrompt,
        version: "1.0.0-STABLE",
        has_truth: masterTruth && masterTruth.length > 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})