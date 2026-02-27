Lost.">
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

  console.log("[process-followups] Iniciando ciclo de recordatorios de ventas...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date();

    // 1. OBTENER CONFIGURACIÓN DE TIEMPOS
    const { data: configs } = await supabaseClient.from('app_config').select('key, value').in('key', ['sales_reminder_1', 'sales_reminder_2', 'sales_reminder_3', 'sales_reminder_4']);
    
    const getDelay = (key: string, defaultVal: number) => {
       const val = configs?.find(c => c.key === key)?.value;
       return val ? parseInt(val) : defaultVal;
    };

    const delays = {
       1: getDelay('sales_reminder_1', 24), // Horas
       2: getDelay('sales_reminder_2', 48), // Horas
       3: getDelay('sales_reminder_3', 72), // Horas
       4: getDelay('sales_reminder_4', 7)   // Días
    };

    // 2. BUSCAR LEADS EN INTENCIÓN ALTA (PENDIENTES DE PAGO)
    const { data: hotLeads } = await supabaseClient
      .from('leads')
      .select('*')
      .eq('buying_intent', 'ALTO')
      .neq('ai_paused', true) // Si está pausado, no molestamos
      .lt('followup_stage', 5); // 5 = Perdido o Completado

    console.log(`[process-followups] Leads calientes detectados: ${hotLeads?.length || 0}`);

    const results = [];

    for (const lead of hotLeads || []) {
       // Calcular tiempo desde el último mensaje del bot (teóricamente cuando se envió el link o el último recordatorio)
       const lastInteraction = new Date(lead.last_message_at || lead.updated_at); 
       const diffMs = now.getTime() - lastInteraction.getTime();
       const diffHours = diffMs / (1000 * 60 * 60);
       
       const currentStage = lead.followup_stage || 0;
       const nextStage = currentStage + 1;

       // Determinar si toca enviar recordatorio
       let shouldSend = false;
       let waitHours = 0;

       if (nextStage === 1) waitHours = delays[1];
       else if (nextStage === 2) waitHours = delays[2];
       else if (nextStage === 3) waitHours = delays[3];
       else if (nextStage === 4) waitHours = delays[4] * 24; // Días a horas

       if (diffHours >= waitHours) {
          shouldSend = true;
       }

       if (shouldSend) {
          console.log(`[process-followups] Ejecutando Stage ${nextStage} para ${lead.nombre}`);

          let message = "";
          
          if (nextStage === 4) {
             // ÚLTIMO INTENTO
             message = `Hola ${lead.nombre}, noté que no pudiste completar tu reserva. ¿Hubo algún problema con el link? Si ya no estás interesado, avísame para liberar el lugar.`;
          } else if (nextStage === 5) {
             // LOGICA DE LEAD PERDIDO (Se ejecuta si ya pasó el stage 4 y sigue sin respuesta tras X días extra? 
             // Simplificación: Al ejecutar stage 4, programamos el cierre.
             // Aquí si entra al bucle de nuevo y stage es 4, pasamos a 5 (Perdido).
          } else {
             // RECORDATORIOS ESTÁNDAR
             message = `Hola ${lead.nombre}, solo un recordatorio amable sobre tu reserva de $1500 MXN. ¿Te puedo ayudar con el proceso de pago?`;
          }

          // Si es el stage 5 (imaginario, lógica de cierre)
          if (nextStage > 4) {
             console.log(`[process-followups] Lead ${lead.nombre} marcado como PERDIDO.`);
             await supabaseClient.from('leads').update({
                buying_intent: 'PERDIDO', // O "BAJO"
                followup_stage: 5,
                summary: `[SISTEMA] Lead marcado como perdido tras 4 intentos de cobro sin respuesta.`
             }).eq('id', lead.id);
             
             results.push({ lead: lead.nombre, action: 'MARK_LOST' });
          } else {
             // Enviar mensaje
             await supabaseClient.from('conversaciones').insert({
                lead_id: lead.id,
                emisor: 'SAMURAI',
                mensaje: message,
                platform: 'AUTO_FOLLOWUP'
             });

             await supabaseClient.from('leads').update({
                followup_stage: nextStage,
                last_message_at: now.toISOString() // Reseteamos el reloj
             }).eq('id', lead.id);

             results.push({ lead: lead.nombre, action: `SENT_STAGE_${nextStage}` });
          }
       }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error("[process-followups] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})