// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[process-followups] Iniciando ciclo de recordatorios de ventas...");

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Internal server error." }), { status: 500, headers: corsHeaders });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();

    // 1. OBTENER CONFIGURACIÓN DE TIEMPOS
    const { data: configs } = await supabaseClient.from('app_config').select('key, value').in('key', ['sales_reminder_1', 'sales_reminder_2', 'sales_reminder_3', 'sales_reminder_4']);
    
    const getDelay = (key: string, defaultVal: number) => {
       const val = configs?.find((c: any) => c.key === key)?.value;
       return val ? parseInt(val) : defaultVal;
    };

    const delays: any = {
       1: getDelay('sales_reminder_1', 24), 
       2: getDelay('sales_reminder_2', 48), 
       3: getDelay('sales_reminder_3', 72), 
       4: getDelay('sales_reminder_4', 7)   
    };

    // 2. BUSCAR LEADS EN INTENCIÓN ALTA (PENDIENTES DE PAGO)
    const { data: hotLeads } = await supabaseClient
      .from('leads')
      .select('*')
      .eq('buying_intent', 'ALTO')
      .neq('ai_paused', true)
      .lt('followup_stage', 5);

    console.log(`[process-followups] Leads detectados: ${hotLeads?.length || 0}`);

    const results = [];

    for (const lead of (hotLeads || []) as any[]) {
       const lastInteraction = new Date(lead.last_message_at || lead.updated_at); 
       const diffMs = now.getTime() - lastInteraction.getTime();
       const diffHours = diffMs / (1000 * 60 * 60);
       
       const currentStage = lead.followup_stage || 0;
       const nextStage = currentStage + 1;

       let shouldSend = false;
       let waitHours = 0;

       if (nextStage === 1) waitHours = delays[1];
       else if (nextStage === 2) waitHours = delays[2];
       else if (nextStage === 3) waitHours = delays[3];
       else if (nextStage === 4) waitHours = delays[4] * 24;

       if (diffHours >= waitHours) shouldSend = true;

       if (shouldSend) {
          let message = "";
          
          if (nextStage === 4) {
             message = `Hola ${lead.nombre}, noté que no pudiste completar tu reserva de $1500 MXN. ¿Hubo algún problema técnico con el link? Si ya no deseas el lugar, avísame para liberarlo a otra persona en lista de espera.`;
          } else {
             message = `Hola ${lead.nombre}, ¿cómo vas con tu proceso de reserva? Solo quería confirmarte que sigo guardando tu lugar para el taller. Avísame si necesitas apoyo con el pago de los $1500.`;
          }

          // Guardar mensaje y avanzar fase
          await supabaseClient.from('conversaciones').insert({
              lead_id: lead.id,
              emisor: 'SAMURAI',
              mensaje: message,
              platform: 'AUTO_FOLLOWUP'
          });

          await supabaseClient.from('leads').update({
              followup_stage: nextStage,
              last_message_at: now.toISOString()
          }).eq('id', lead.id);

          results.push({ lead: lead.nombre, stage: nextStage });
       }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})