// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[process-followups] Iniciando ciclo de cierre táctico con verificación WooCommerce...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date();

    // 1. OBTENER CONFIGURACIÓN
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string, defaultVal: any) => configs?.find((c: any) => c.key === key)?.value || defaultVal;

    const delays = {
       1: parseInt(getConfig('sales_reminder_1', 24)), 
       2: parseInt(getConfig('sales_reminder_2', 48)), 
       3: parseInt(getConfig('sales_reminder_3', 72)), 
       4: parseInt(getConfig('sales_reminder_4', 7)) * 24   
    };

    const bookingLink = getConfig('booking_link', 'https://theelephantbowl.com/reservar');
    const wcUrl = getConfig('wc_url');
    const wcKey = getConfig('wc_key');
    const wcSecret = getConfig('wc_secret');

    // 2. BUSCAR LEADS EN INTENCIÓN ALTA (PENDIENTES DE PAGO)
    const { data: hotLeads } = await supabaseClient
      .from('leads')
      .select('*')
      .eq('buying_intent', 'ALTO')
      .neq('ai_paused', true)
      .neq('buying_intent', 'COMPRADO') // No procesar si ya compró
      .lt('followup_stage', 5);

    const results = [];

    for (const lead of (hotLeads || [])) {
       // --- CHECK WOOCOMMERCE ---
       let hasPaid = false;
       if (wcUrl && wcKey && wcSecret && lead.email) {
          try {
             // Buscar ordenes por email
             const response = await fetch(`${wcUrl}/wp-json/wc/v3/orders?search=${lead.email}&consumer_key=${wcKey}&consumer_secret=${wcSecret}`);
             if (response.ok) {
                const orders = await response.json();
                // Verificar si hay alguna orden pagada o procesando recientemente
                const paidOrder = orders.find((o: any) => 
                   ['completed', 'processing'].includes(o.status)
                );
                
                if (paidOrder) {
                   hasPaid = true;
                   console.log(`[WooCommerce] Pago detectado para ${lead.email}`);
                   
                   // Actualizar Lead a CLIENTE
                   await supabaseClient.from('leads').update({
                      buying_intent: 'COMPRADO',
                      summary: `CLIENTE CONFIRMADO. Orden #${paidOrder.id} detectada en WooCommerce.`,
                      followup_stage: 100 // Stage de éxito
                   }).eq('id', lead.id);

                   // Enviar mensaje de agradecimiento
                   await supabaseClient.from('conversaciones').insert({
                      lead_id: lead.id,
                      emisor: 'SAMURAI',
                      mensaje: `¡Hola ${lead.nombre}! Confirmamos tu inscripción exitosamente (Orden #${paidOrder.id}). Gracias por unirte a la tribu. Te enviaremos los detalles finales por correo.`,
                      platform: 'AUTO_CONFIRM'
                   });
                   
                   results.push({ lead: lead.nombre, status: 'PAID_DETECTED' });
                   continue; // Saltar lógica de cobro
                }
             }
          } catch (wcErr) {
             console.error(`[WooCommerce Check Error] ${lead.email}:`, wcErr);
          }
       }

       // --- LÓGICA DE RECORDATORIO (Solo si no pagó) ---
       const lastInteraction = new Date(lead.last_message_at || lead.created_at); 
       const diffHours = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);
       const nextStage = (lead.followup_stage || 0) + 1;

       if (diffHours >= delays[nextStage]) {
          let message = "";
          const citySuffix = lead.ciudad ? ` para el taller en ${lead.ciudad}` : " para el taller";

          switch (nextStage) {
            case 1:
              message = `Hola ${lead.nombre}, solo quería confirmar que recibieras bien el link de reserva${citySuffix}. ¿Tuviste oportunidad de verlo? Aquí te lo dejo de nuevo: ${bookingLink}`;
              break;
            case 2:
              message = `Qué tal ${lead.nombre}, sigo guardando tu lugar${citySuffix}. ¿Hubo algún problema técnico con el pago? Si prefieres hacer transferencia directa, avísame y te paso la cuenta.`;
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