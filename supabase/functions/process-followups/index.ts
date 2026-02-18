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

  console.log("[process-followups] Iniciando proceso de follow-ups automáticos...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date().toISOString();
    
    // 1. OBTENER CONFIGURACIÓN
    const { data: config } = await supabaseClient
      .from('followup_config')
      .select('*')
      .single();

    if (!config || !config.enabled) {
      console.log("[process-followups] Sistema deshabilitado");
      return new Response(JSON.stringify({ message: "Follow-up system disabled" }), { headers: corsHeaders });
    }

    console.log("[process-followups] Configuración cargada:", config);

    // 2. VERIFICAR HORARIO PERMITIDO
    const currentDate = new Date();
    const currentHour = currentDate.getHours();
    const currentDay = currentDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    const isAllowedTime = 
      config.allowed_days.includes(currentDay) &&
      currentHour >= config.start_hour &&
      currentHour < config.end_hour;

    if (!isAllowedTime) {
      console.log(`[process-followups] Fuera de horario permitido. Día: ${currentDay}, Hora: ${currentHour}`);
      return new Response(JSON.stringify({ message: "Outside allowed hours" }), { headers: corsHeaders });
    }

    // 3. PROCESAR AUTO-RESTART (Leads con #STOP que deben reactivarse)
    const { data: leadsToRestart } = await supabaseClient
      .from('leads')
      .select('*')
      .eq('ai_paused', true)
      .not('auto_restart_scheduled_at', 'is', null)
      .lte('auto_restart_scheduled_at', now);

    console.log(`[process-followups] Leads para auto-restart: ${leadsToRestart?.length || 0}`);

    for (const lead of leadsToRestart || []) {
      console.log(`[process-followups] Auto-reactivando lead: ${lead.nombre} (${lead.id})`);
      
      // Obtener últimos mensajes para contexto
      const { data: recentMessages } = await supabaseClient
        .from('conversaciones')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const contextSummary = recentMessages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

      // Mensaje de reactivación inteligente
      const restartMessage = `Hola ${lead.nombre || 'amigo'}, retomo la conversación. Vi que hablaste con mi equipo. ¿En qué más puedo ayudarte?`;

      // Insertar mensaje de reactivación
      await supabaseClient.from('conversaciones').insert({
        lead_id: lead.id,
        emisor: 'SAMURAI',
        mensaje: restartMessage,
        platform: 'AUTO_RESTART',
        metadata: { context: contextSummary, trigger: 'auto_restart' }
      });

      // Actualizar lead
      await supabaseClient.from('leads').update({
        ai_paused: false,
        auto_restart_scheduled_at: null,
        last_bot_message_at: now
      }).eq('id', lead.id);

      // Log de actividad
      await supabaseClient.from('activity_logs').insert({
        action: 'UPDATE',
        resource: 'BRAIN',
        description: `Auto-restart ejecutado para ${lead.nombre}`,
        status: 'OK',
        metadata: { lead_id: lead.id, trigger: 'auto_restart' }
      });
    }

    // 4. PROCESAR FOLLOW-UPS REGULARES
    const { data: leadsForFollowup } = await supabaseClient
      .from('leads')
      .select('*')
      .eq('ai_paused', false)
      .not('next_followup_at', 'is', null)
      .lte('next_followup_at', now)
      .lte('followup_stage', config.max_followup_stage);

    console.log(`[process-followups] Leads para follow-up: ${leadsForFollowup?.length || 0}`);

    for (const lead of leadsForFollowup || []) {
      const stage = lead.followup_stage || 1;
      console.log(`[process-followups] Enviando follow-up stage ${stage} a: ${lead.nombre} (${lead.id})`);

      // Seleccionar mensaje según stage
      let messageTemplate = config.stage_1_message;
      if (stage === 2) messageTemplate = config.stage_2_message;
      if (stage === 3) messageTemplate = config.stage_3_message;

      const message = messageTemplate.replace('{nombre}', lead.nombre || 'amigo');

      // Insertar mensaje
      await supabaseClient.from('conversaciones').insert({
        lead_id: lead.id,
        emisor: 'SAMURAI',
        mensaje: message,
        platform: 'AUTO_FOLLOWUP',
        metadata: { stage, trigger: 'followup' }
      });

      // Registrar en historial
      await supabaseClient.from('followup_history').insert({
        lead_id: lead.id,
        stage,
        message_sent: message
      });

      // Calcular próximo follow-up
      const nextStage = stage + 1;
      let nextFollowupAt = null;

      if (nextStage <= config.max_followup_stage) {
        let delayMinutes = config.stage_1_delay;
        if (nextStage === 2) delayMinutes = config.stage_2_delay;
        if (nextStage === 3) delayMinutes = config.stage_3_delay;

        const nextTime = new Date(Date.now() + delayMinutes * 60 * 1000);
        nextFollowupAt = nextTime.toISOString();
      }

      // Actualizar lead
      await supabaseClient.from('leads').update({
        followup_stage: nextStage,
        next_followup_at: nextFollowupAt,
        last_bot_message_at: now
      }).eq('id', lead.id);
    }

    const summary = {
      success: true,
      timestamp: now,
      leads_restarted: leadsToRestart?.length || 0,
      followups_sent: leadsForFollowup?.length || 0,
      config_active: config.enabled
    };

    console.log("[process-followups] Proceso completado:", summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("[process-followups] Error crítico:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})