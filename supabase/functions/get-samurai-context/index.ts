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

    const { message, lead_id, kommo_id, phone, simulate_reply = false } = await req.json();

    // 1. CARGAR CONFIGURACIONES
    const { data: configData } = await supabaseClient.from('app_config').select('key, value');
    const configs: any = {};
    configData?.forEach(i => configs[i.key] = i.value);

    // 2. REGLAS TÉCNICAS (AHORA INTERNAS Y SIMPLIFICADAS)
    const technicalRules = `
# REGLAS TÉCNICAS DE EXTRACCIÓN
Al final de cada respuesta, DEBES incluir este bloque exacto de análisis:
[[ANALYSIS:
{
  "name": "Nombre del cliente",
  "city": "Ciudad detectada",
  "mood": "FELIZ/NEUTRO/ENOJADO",
  "intent": "BAJO/MEDIO/ALTO",
  "summary": "Resumen breve",
  "handoff_required": false
}
]]
`;

    const ecommerceUrl = configs['ecommerce_url'] || "https://theelephantbowl.com";
    const productId = configs['main_product_id'] || "1483";
    const productPrice = configs['main_product_price'] || "1500";
    
    let strategyPrompt = (configs['prompt_estrategia_cierre'] || "")
        .replace(/{ecommerce_url}/g, ecommerceUrl)
        .replace(/{main_product_id}/g, productId)
        .replace(/{main_product_price}/g, productPrice);

    const fullSystemPrompt = `
${technicalRules}
${configs['prompt_adn_core'] || ''}
${configs['prompt_protocolos'] || ''}
${strategyPrompt}
${configs['prompt_reaprendizaje'] || ''}
${configs['prompt_memoria'] || ''}

CLIENTE: Desconocido (Sin ciudad)
MENSAJE ACTUAL: ${message}
    `;

    // 3. SI ES SIMULACIÓN, LLAMAMOS A OPENAI (O TU PROVEEDOR)
    if (simulate_reply) {
       // Aquí podrías llamar a OpenAI directamente si tienes la key, 
       // o devolver un mensaje de éxito indicando que el prompt está listo.
       // Por ahora, devolvemos una respuesta simulada exitosa basada en el ADN.
       const reply = `¡Hola! Soy Samurai de The Elephant Bowl. He recibido tu mensaje: "${message}". Mi cerebro está configurado con éxito y listo para cerrar esta venta.`;
       
       return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ system_prompt: fullSystemPrompt, status: "ready" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})