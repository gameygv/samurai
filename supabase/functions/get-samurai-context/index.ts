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

    // 1. OBTENER TODAS LAS CONFIGURACIONES DE PROMPTS
    const { data: configData } = await supabaseClient
        .from('app_config')
        .select('key, value')
        .eq('category', 'PROMPT');
    
    const prompts: any = {};
    configData?.forEach(i => prompts[i.key] = i.value);

    // 2. OBTENER DATOS DEL LEAD (Si existe)
    let leadContext = "Nombre: Prospecto Anónimo\nCiudad: En análisis...";
    if (lead_id) {
        const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
        if (lead) {
            leadContext = `
Nombre: ${lead.nombre || 'Prospecto'}
Ciudad: ${lead.ciudad || 'Desconocida'}
Intención de Compra: ${lead.buying_intent || 'BAJA'}
Perfil Psicologico: ${lead.perfil_psicologico || 'En análisis...'}
Resumen Memoria: ${lead.summary || 'Sin historial previo.'}
            `;
        }
    }

    // 3. ENSAMBLAJE MAESTRO (The Great Prompt)
    const fullSystemPrompt = `
${prompts['prompt_core'] || '# IDENTIDAD SAMURAI\nEres un experto en ventas.'}

=== 🛡️ REGLAS TÉCNICAS ===
${prompts['prompt_technical'] || 'Responde de forma concisa.'}

=== 📚 CONTEXTO DEL NEGOCIO ===
${prompts['prompt_context'] || 'Vendemos instrumentos de sonoterapia.'}

=== 🧠 ANALISIS PSICOLÓGICO Y PERFILADO ===
${prompts['prompt_psychology'] || 'Analiza el sentimiento del cliente.'}

=== 📸 PROTOCOLO DE VISIÓN (MULTIMEDIA) ===
${prompts['prompt_vision'] || 'Si el cliente envía una imagen, analízala.'}

=== 🔄 LECCIONES APRENDIDAS (#CIA) ===
${prompts['prompt_relearning'] || 'No hay reglas adicionales.'}

=== 👤 CONTEXTO ACTUAL DEL CLIENTE ===
${leadContext}

=== ⚡ FORMATO DE SALIDA OBLIGATORIO ===
Responde al mensaje del cliente y termina SIEMPRE con el bloque ANALYSIS en JSON:
[[ANALYSIS: {
  "mood": "FELIZ|NEUTRO|ENOJADO",
  "intent": "ALTO|MEDIO|BAJO",
  "summary": "Resumen para tu memoria",
  "handoff_required": false
}]]
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