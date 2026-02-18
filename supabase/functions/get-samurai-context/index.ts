import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Valores por defecto para fallback
const DEFAULTS = {
  'prompt_core': `Eres Samurai, asistente experto de The Elephant Bowl. Tu misión es vender el anticipo de lugar de $1500.`,
  'prompt_technical': `Responde en texto plano.`,
  'prompt_behavior': `Sé empático pero enfocado en el cierre.`,
  'prompt_psychology': `Analiza la necesidad emocional del cliente.`,
  'shop_base_url': `https://theelephantbowl.com/finalizar-compra/`,
  'reservation_product_id': `0`
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { message, lead_name, lead_phone, lead_id, platform } = await req.json();

    let currentLeadId = lead_id;
    let leadMood = "NEUTRO";
    let buyingIntent = "DESCONOCIDO";
    let leadSummary = "";

    // 1. OBTENER CONFIGURACIÓN COMPLETA
    const { data: configData } = await supabaseClient.from('app_config').select('key, value');
    const configs: Record<string, string> = { ...DEFAULTS };
    if (configData) {
       configData.forEach((item: any) => { configs[item.key] = item.value; });
    }

    // 2. IDENTIFICACIÓN DEL LEAD
    if (!currentLeadId && lead_phone) {
       const { data: existingLead } = await supabaseClient
          .from('leads')
          .select('*')
          .eq('telefono', lead_phone)
          .maybeSingle();
       
       if (existingLead) {
          currentLeadId = existingLead.id;
          leadMood = existingLead.estado_emocional_actual || "NEUTRO";
          buyingIntent = existingLead.buying_intent || "BAJO";
          leadSummary = existingLead.summary || "";
       } else {
          const { data: newLead } = await supabaseClient
             .from('leads')
             .insert({ nombre: lead_name || 'Prospecto', telefono: lead_phone, origen: platform || 'API' })
             .select().single();
          if (newLead) currentLeadId = newLead.id;
       }
    }

    // 3. GENERAR LINK DE PAGO DINÁMICO
    const checkoutUrl = `${configs['shop_base_url']}?add-to-cart=${configs['reservation_product_id']}`;

    // 4. CONSTRUCCIÓN DEL PROMPT MAESTRO (THE ELEPHANT BOWL EDITION)
    const fullSystemPrompt = `
=== 🧠 IDENTIDAD ELEPHANT BOWL ===
${configs['prompt_core']}
Tu objetivo máximo: Que el cliente aparte su lugar hoy mismo.
Producto: Anticipo de lugar para talleres/cursos.
Precio: $1500 MXN.

=== 🔗 LINK DE PAGO DIRECTO ===
Cuando el cliente esté listo para apartar o pida cómo pagar, envía EXCLUSIVAMENTE este link:
${checkoutUrl}

=== 📜 COMPORTAMIENTO Y VENTAS ===
${configs['prompt_behavior']}
${configs['prompt_objections']}

=== 🧬 CONTEXTO DEL CLIENTE ===
Nombre: ${lead_name || 'Prospecto'}
Mood: ${leadMood}
Intención: ${buyingIntent}
Resumen Previo: ${leadSummary}

=== 🔮 PSICOLOGÍA Y CIERRE ===
${configs['prompt_psychology']}
${configs['prompt_closing_strategy']}

=== ⚡ INSTRUCCIÓN CRÍTICA ===
1. Eres la voz de The Elephant Bowl. 
2. Si el cliente pregunta por un taller específico, usa la información de la web (https://theelephantbowl.com).
3. NO des rodeos. Si detectas interés, ofrece el anticipo de $1500.
4. Siempre termina con el bloque de análisis:
[[ANALYSIS: {"mood": "...", "intent": "...", "summary": "..."}]]
    `;

    return new Response(
      JSON.stringify({
        lead_id: currentLeadId,
        system_prompt: fullSystemPrompt,
        debug: {
            checkout_link: checkoutUrl,
            product_id: configs['reservation_product_id']
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})