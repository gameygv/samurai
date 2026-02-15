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

    const { message, lead_name, lead_id, platform } = await req.json();

    // DETECCIÓN DE APRENDIZAJE
    if (message && message.includes('#CORREGIRIA')) {
      const feedback = message.replace('#CORREGIRIA', '').trim();
      await supabaseClient.from('errores_ia').insert({
        mensaje_cliente: "Feedback Directo",
        respuesta_ia: "N/A",
        correccion_sugerida: feedback,
        categoria: "ENTRENAMIENTO",
        estado_correccion: "PENDIENTE",
        severidad: "MEDIA",
        created_by: "MakeAutomation"
      });

      return new Response(
        JSON.stringify({
          action: 'LEARNING_LOGGED',
          reply: `🫡 Entendido. He registrado esta mejora: "${feedback}". La aplicaré en mi próximo entrenamiento.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // CONSTRUCCIÓN DEL CONTEXTO BASADO EN PROMPTS CORE
    const { data: configData } = await supabaseClient
      .from('app_config')
      .select('key, value')
      .eq('category', 'PROMPT')

    const prompts: Record<string, string> = {}
    configData?.forEach((item: any) => { prompts[item.key] = item.value; });

    // Registro de Actividad
    await supabaseClient.from('activity_logs').insert({
       action: 'CHAT', resource: 'BRAIN', description: `Generando contexto para: ${lead_name || 'Desconocido'}`, status: 'OK'
    });

    // System Prompt Maestro (Consolidado)
    const fullSystemPrompt = `
### PILAR 1: ADN & SISTEMA
${prompts['prompt_core'] || ''}
${prompts['prompt_technical'] || ''}
${prompts['prompt_behavior'] || ''}
${prompts['prompt_objections'] || ''}

### PILAR 2: CONTEXTO & MEMORIA
${prompts['prompt_data_injection'] || ''}
${prompts['prompt_memory'] || ''}
${prompts['prompt_tone'] || ''}
${prompts['prompt_recommendations'] || ''}

### PILAR 3: APRENDIZAJE ADAPTATIVO
${prompts['prompt_learning_trigger'] || ''}
${prompts['prompt_relearning'] || ''}

### PILAR 4: VISIÓN (OJO DE HALCÓN)
${prompts['prompt_vision_analysis'] || ''}
${prompts['prompt_match_validation'] || ''}
${prompts['prompt_post_validation'] || ''}

---
CONTEXTO DE CONVERSACIÓN ACTUAL:
- CLIENTE: ${lead_name || 'Desconocido'}
- PLATAFORMA: ${platform || 'WhatsApp'}
- FECHA/HORA: ${new Date().toLocaleString('es-MX')}
    `

    return new Response(
      JSON.stringify({
        action: 'REPLY',
        system_prompt: fullSystemPrompt,
        config: { temperature: 0.3, model: 'gemini-1.5-pro' }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})