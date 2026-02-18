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

    const { message, lead_id, lead_phone } = await req.json();

    // 1. OBTENER CONFIGURACIÓN Y CONTEXTO
    const { data: configData } = await supabaseClient.from('app_config').select('key, value');
    const configs: any = {};
    configData?.forEach(i => configs[i.key] = i.value);

    // 2. DATOS ACTUALES DEL LEAD
    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();

    const fullSystemPrompt = `
=== 🧠 IDENTIDAD SAMURAI ===
${configs['prompt_core']}

=== 🕵️ FUNCIÓN DE PERFILADO (OBLIGATORIO) ===
Tu tarea secundaria es identificar y registrar datos del cliente en el bloque ANALYSIS:
1. CIUDAD: Detecta de dónde escribe.
2. PREFERENCIAS: ¿Qué le gusta? ¿Qué instrumentos prefiere?
3. PERFIL: ¿Es un profesional, un principiante, alguien curioso?
4. HANDOFF: Si el cliente está MOLESTO, pide hablar con un humano, o la situación es demasiado compleja para ti, activa "handoff_required": true y notifícale amablemente que un especialista humano tomará el control.

=== 🧬 MEMORIA ACTUAL DEL CLIENTE ===
Nombre: ${lead?.nombre || 'Prospecto'}
Ciudad actual registrada: ${lead?.ciudad || 'Desconocida'}
Perfil Psicologico: ${lead?.perfil_psicologico || 'En análisis...'}
Preferencias: ${lead?.preferencias || 'Sin datos...'}

=== ⚡ FORMATO DE SALIDA ===
Responde al cliente y termina SIEMPRE con este JSON exacto:
[[ANALYSIS: {
  "mood": "FELIZ|NEUTRO|ENOJADO",
  "intent": "ALTO|MEDIO|BAJO",
  "city": "Ciudad detectada",
  "preferences": "Resumen de lo que busca",
  "psychology": "Perfil detectado",
  "summary": "Resumen para tu memoria",
  "handoff_required": false,
  "handoff_reason": ""
}]]
    `;

    return new Response(
      JSON.stringify({ system_prompt: fullSystemPrompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})