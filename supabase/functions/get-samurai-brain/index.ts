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

    // 1. Obtener todos los prompts del sistema
    const { data: configs } = await supabaseClient
      .from('app_config')
      .select('key, value')
      .eq('category', 'PROMPT');

    const promptMap = configs?.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}) || {};

    // 2. Obtener la Verdad Maestra (Solo lo más importante para no saturar tokens)
    const { data: knowledge } = await supabaseClient
      .from('main_website_content')
      .select('title, content')
      .eq('scrape_status', 'success')
      .limit(10);

    const masterTruth = knowledge?.map(k => `[FUENTE: ${k.title}]\n${k.content?.substring(0, 1000)}`).join('\n\n') || "No hay conocimiento indexado aún.";

    // 3. Construir el Prompt Maestro
    const systemPrompt = `
      ${promptMap['prompt_adn_core'] || 'Eres Samurai, experto de The Elephant Bowl.'}
      
      # VERDAD MAESTRA (CONTEXTO REAL DEL SITIO WEB)
      IMPORTANTE: Los siguientes datos son la ÚNICA realidad. Si el cliente pregunta por talleres, formación o instrumentos, usa ESTA información:
      ${masterTruth}

      # PROTOCOLOS DE CONDUCTA
      ${promptMap['prompt_protocolos'] || ''}

      # REGLAS APRENDIDAS (#CIA)
      ${promptMap['prompt_relearning'] || ''}

      # INSTRUCCIÓN CRÍTICA ANTI-ALUCINACIÓN
      - NUNCA digas que "no parecemos ofrecer talleres". 
      - SIEMPRE asume que somos los líderes en formación de sonoterapia.
      - Si no encuentras un dato específico en la Verdad Maestra, di que vas a consultar con un humano, pero jamás inventes que no existe el servicio.
    `;

    return new Response(
      JSON.stringify({ 
        system_prompt: systemPrompt,
        version: "0.8.6-PRO",
        knowledge_count: knowledge?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})