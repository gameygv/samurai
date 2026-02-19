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

    // 3. CONSTRUCCIÓN POR PRIORIDAD ABSOLUTA
    const systemPrompt = `
      # IDENTIDAD CRÍTICA (NIVEL 0)
      TU NOMBRE ES SAM. Preséntate SIEMPRE como "Sam", asesor experto de The Elephant Bowl.
      ${promptMap['prompt_adn_core'] || 'Eres el cerrador de ventas de elite.'}

      # REGLAS DE NEGOCIO (NIVEL 1)
      ${promptMap['prompt_estrategia_cierre'] || ''}
      ${promptMap['prompt_protocolos'] || ''}

      # VERDAD MAESTRA (NIVEL 2)
      SI ESTA SECCIÓN TIENE DATOS, ÚSALOS COMO VERDAD ABSOLUTA SOBRE TALLERES Y PRECIOS:
      ${truthBlock}

      # PROTOCOLO ANTI-ALUCINACIÓN
      1. Si no hay datos en el NIVEL 2 sobre un taller específico, di: "Esa fecha aún no está confirmada en nuestra web oficial, pero puedo hablarte de nuestra metodología de Sonoterapia que nos hace únicos."
      2. NUNCA inventes talleres en ciudades que no veas en el NIVEL 2.
      3. Tu objetivo es que paguen el anticipo de $1500 MXN usando el link de la tienda.
    `;

    return new Response(
      JSON.stringify({ 
        system_prompt: systemPrompt,
        version: "0.9.5-IDENTITY-PRO",
        has_truth: masterTruth && masterTruth.length > 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})