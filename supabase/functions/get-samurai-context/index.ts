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

    const { message, lead_name, lead_id, platform, relevant_knowledge } = await req.json();

    // 1. DETECCIÓN DE APRENDIZAJE (FEEDBACK HUMANO DIRECTO)
    if (message && message.includes('#CORREGIRIA')) {
      const feedback = message.replace('#CORREGIRIA', '').trim();
      await supabaseClient.from('errores_ia').insert({
        mensaje_cliente: "Feedback Directo Manual",
        respuesta_ia: "N/A - Intervención Humana",
        correccion_sugerida: feedback,
        categoria: "ENTRENAMIENTO",
        estado_correccion: "VALIDADA", // Auto-validamos si viene directo del panel con el comando
        severidad: "MEDIA",
        created_by: "MakeAutomation"
      });

      return new Response(
        JSON.stringify({
          action: 'LEARNING_LOGGED',
          reply: `🫡 Entendido. He registrado esta corrección: "${feedback}". La he marcado como VALIDADA para aplicarla de inmediato.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. OBTENER PROMPTS CONFIGURADOS
    const { data: configData } = await supabaseClient
      .from('app_config')
      .select('key, value')
      .eq('category', 'PROMPT')

    const prompts: Record<string, string> = {}
    configData?.forEach((item: any) => { prompts[item.key] = item.value; });

    // 3. OBTENER PERFIL DEL LEAD (Si existe ID)
    let leadProfile = "Perfil desconocido";
    let leadMood = "NEUTRO";
    
    if (lead_id) {
       const { data: lead } = await supabaseClient
         .from('leads')
         .select('*')
         .eq('id', lead_id) // Asumiendo que Make pasa el ID de Supabase, si pasa el de Kommo habría que ajustar
         .maybeSingle();
       
       if (lead) {
          leadProfile = `
          - Nombre: ${lead.nombre || lead_name}
          - Estado Emocional: ${lead.estado_emocional_actual || 'NEUTRO'}
          - Score Confianza: ${lead.confidence_score || 0}%
          - Etapa Funnel: ${lead.funnel_stage || 'Inicial'}
          - Ciudad: ${lead.ciudad || 'N/A'}
          `;
          leadMood = lead.estado_emocional_actual || "NEUTRO";
       }
    }

    // 4. OBTENER HISTORIAL DE CHAT RECIENTE (Contexto Inmediato)
    let chatHistoryText = "";
    if (lead_id) {
       const { data: history } = await supabaseClient
          .from('conversaciones')
          .select('emisor, mensaje, created_at')
          .eq('lead_id', lead_id)
          .order('created_at', { ascending: false })
          .limit(10); // Últimos 10 mensajes
       
       if (history && history.length > 0) {
          // Invertimos para orden cronológico
          chatHistoryText = history.reverse().map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n');
       }
    }

    // 5. OBTENER LECCIONES APRENDIDAS (Correcciones Validadas)
    // Esto es CRUCIAL: Inyectamos errores pasados que ya fueron corregidos para que no los repita.
    const { data: learnings } = await supabaseClient
       .from('errores_ia')
       .select('correccion_sugerida')
       .eq('estado_correccion', 'VALIDADA')
       .order('applied_at', { ascending: false })
       .limit(5);

    const learnedLessons = learnings?.map(l => `- ${l.correccion_sugerida}`).join('\n') || "Ninguna por ahora.";


    // 6. CONSTRUCCIÓN DEL SYSTEM PROMPT FINAL
    const fullSystemPrompt = `
=== IDENTIDAD ===
${prompts['prompt_core'] || ''}

=== REGLAS TÉCNICAS (OUTPUT JSON) ===
${prompts['prompt_technical'] || ''}

=== PROTOCOLOS DE COMPORTAMIENTO ===
${prompts['prompt_behavior'] || ''}
${prompts['prompt_objections'] || ''}

=== ESTRATEGIA DE VENTA & PSICOLOGÍA ===
${prompts['prompt_psychology'] || ''}
${prompts['prompt_closing_strategy'] || ''}
${prompts['prompt_recommendations'] || ''}
${prompts['prompt_tone'] || ''}

=== CONTEXTO DEL CLIENTE (CRM) ===
${prompts['prompt_data_injection'] || ''}
DATOS REALES DEL CLIENTE:
${leadProfile}

=== MEMORIA DE CONVERSACIÓN RECIENTE ===
${prompts['prompt_memory'] || ''}
HISTORIAL (Últimos mensajes):
${chatHistoryText}

=== CONOCIMIENTO EXTERNO (RAG) ===
${relevant_knowledge ? `Información recuperada de la Base de Conocimiento:\n${relevant_knowledge}` : 'No se requiere conocimiento externo específico para este turno.'}

=== ⚠️ LECCIONES APRENDIDAS (PRIORIDAD ALTA) ===
Estas son correcciones de errores pasados que NO DEBES REPETIR:
${learnedLessons}
${prompts['prompt_relearning'] || ''}

---
INSTRUCCIÓN FINAL: Analiza el último mensaje del cliente, evalúa su perfil psicológico, consulta la memoria y genera tu respuesta en formato JSON.
    `

    // Registro de Actividad
    await supabaseClient.from('activity_logs').insert({
       action: 'CHAT', 
       resource: 'BRAIN', 
       description: `Contexto generado para ${lead_name || 'Lead'} (Mood: ${leadMood})`, 
       status: 'OK',
       metadata: { model: 'gemini-1.5-pro', context_length: fullSystemPrompt.length }
    });

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