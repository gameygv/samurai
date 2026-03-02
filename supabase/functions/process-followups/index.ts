// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[process-followups] Iniciando ciclo de cierre táctico...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date();

    // 1. OBTENER CONFIGURACIÓN DE TIEMPOS
    const { data: configs } = await supabaseClient.from('app_config').select('key, value').in('key', ['sales_reminder_1', 'sales_reminder_2', 'sales_reminder_3', 'sales_reminder_4', 'booking_link']);
    
    const getConfig = (key: string, defaultVal: any) => {
       const val = configs?.find((c: any) => c.key === key)?.value;
       return val || defaultVal;
    };

    const delays = {
       1: parseInt(getConfig('sales_reminder_1', 24)), 
       2: parseInt(getConfig('sales_reminder_2', 48)), 
       3: parseInt(getConfig('sales_reminder_3', 72)), 
       4: parseInt(getConfig('sales_reminder_4', 7)) * 24   
    };

    const bookingLink = getConfig('booking_link', 'https://theelephantbowl.com/reservar');

    // 2. BUSCAR LEADS EN INTENCIÓN ALTA (PENDIENTES DE PAGO)
    const { data: hotLeads } = await supabaseClient
      .from('leads')
      .select('*')
      .eq('buying_intent', 'ALTO')
      .neq('ai_paused', true)
      .lt('followup_stage', 5);

    const results = [];

    for (const lead of (hotLeads || [])) {
       const lastInteraction = new Date(lead.last_message_at || lead.created_at); 
       const diffHours = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);
       
       const nextStage = (lead.followup_stage || 0) + 1;
       if (diffHours >= delays[nextStage]) {
          
          let message = "";
          const citySuffix = lead.ciudad ? ` para el taller en ${lead.ciudad}` : " para el taller";

          switch (nextStage) {
            case 1:
              message = `Hola ${lead.nombre}, solo quería confirmar que recibieras bien el link de reserva${citySuffix}. ¿Tuviste oportunidad de verlo?`;
              break;
            case 2:
              message = `Qué tal ${lead.nombre}, sigo guardando tu lugar${citySuffix}. ¿Hubo algún problema técnico con el pago de los $1500? Avísame si necesitas apoyo.`;
              break;
            case 3:
              message = `Hola ${lead.nombre}, te escribo porque el cupo${citySuffix} se está agotando. ¿Aún te interesa asegurar tu lugar o lo libero para alguien en lista de espera?`;
              break;
            case 4:
              message = `Atención ${lead.nombre}: El sistema me indica que no se completó tu reserva. Liberaré tu lugar en las próximas horas. Si deseas conservarlo, usa este link ahora mismo: ${bookingLink}`;
              break;
          }

          if (message) {
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
    }

    return new Response(JSON.stringify({ success: true, processed: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})