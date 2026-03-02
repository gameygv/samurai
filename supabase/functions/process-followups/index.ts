// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log("[process-followups] Iniciando ciclo de cierre táctico y reactivación...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date();

    // 1. OBTENER CONFIGURACIÓN
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string, defaultVal: any) => configs?.find((c: any) => c.key === key)?.value || defaultVal;

    // Config de Ventas (High Intent)
    const delays = {
       1: parseInt(getConfig('sales_reminder_1', 24)), 
       2: parseInt(getConfig('sales_reminder_2', 48)), 
       3: parseInt(getConfig('sales_reminder_3', 72)), 
       4: parseInt(getConfig('sales_reminder_4', 7)) * 24   
    };

    // Config de Reactivación (Low/Med Intent) - NUEVO
    const engagementDelayHours = parseInt(getConfig('engagement_reminder_hours', 24));

    // WooCommerce & Webhook Setup
    const wcUrl = getConfig('wc_url') || "https://theelephantbowl.com";
    const productId = getConfig('wc_product_id') || "1483"; 
    const bookingLink = `${wcUrl}/checkout/?add-to-cart=${productId}`;
    const wcKey = getConfig('wc_key');
    const wcSecret = getConfig('wc_secret');
    const webhookUrl = getConfig('webhook_sale');

    const results = [];
    const reactivated = [];

    // ==========================================
    // FLUJO 1: CIERRE DE VENTAS (HIGH INTENT)
    // ==========================================
    const { data: hotLeads } = await supabaseClient
      .from('leads')
      .select('*')
      .eq('buying_intent', 'ALTO')
      .neq('ai_paused', true)
      .neq('buying_intent', 'COMPRADO')
      .lt('followup_stage', 5);

    for (const lead of (hotLeads || [])) {
       // Check Woo
       let hasPaid = false;
       if (wcUrl && wcKey && wcSecret && lead.email) {
          try {
             const response = await fetch(`${wcUrl}/wp-json/wc/v3/orders?search=${lead.email}&consumer_key=${wcKey}&consumer_secret=${wcSecret}`);
             if (response.ok) {
                const orders = await response.json();
                const paidOrder = orders.find((o: any) => ['completed', 'processing'].includes(o.status));
                if (paidOrder) {
                   hasPaid = true;
                   await supabaseClient.from('leads').update({
                      buying_intent: 'COMPRADO',
                      summary: `CLIENTE CONFIRMADO. Orden #${paidOrder.id} detectada en WooCommerce.`,
                      followup_stage: 100
                   }).eq('id', lead.id);
                   await sendMessage(supabaseClient, webhookUrl, lead, `¡Hola ${lead.nombre}! Confirmamos tu inscripción exitosamente (Orden #${paidOrder.id}). Gracias por unirte a la tribu.`, 'AUTO_CONFIRM');
                   results.push({ lead: lead.nombre, status: 'PAID_DETECTED' });
                   continue;
                }
             }
          } catch (e) { console.error(e); }
       }

       // Time Check for Sales
       const lastInteraction = new Date(lead.last_message_at || lead.created_at); 
       const diffHours = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);
       const nextStage = (lead.followup_stage || 0) + 1;

       if (diffHours >= delays[nextStage]) {
          let message = "";
          const citySuffix = lead.ciudad ? ` para el taller en ${lead.ciudad}` : " para el taller";

          switch (nextStage) {
            case 1: message = `Hola ${lead.nombre}, solo quería confirmar que recibieras bien el link de reserva${citySuffix}. ¿Tuviste oportunidad de verlo? Aquí te lo dejo de nuevo: ${bookingLink}`; break;
            case 2: message = `Qué tal ${lead.nombre}, sigo guardando tu lugar${citySuffix}. ¿Hubo algún problema técnico con el pago? Si prefieres hacer transferencia directa, avísame y te paso la cuenta.`; break;
            case 3: message = `Hola ${lead.nombre}, te escribo porque el cupo${citySuffix} se está agotando. ¿Aún te interesa asegurar tu lugar o lo libero para alguien en lista de espera?`; break;
            case 4: message = `Atención ${lead.nombre}: El sistema me indica que no se completó tu reserva. Liberaré tu lugar en las próximas horas. Si deseas conservarlo, usa este link ahora mismo: ${bookingLink}`; break;
          }

          if (message) {
            await sendMessage(supabaseClient, webhookUrl, lead, message, 'AUTO_FOLLOWUP_SALE');
            await supabaseClient.from('leads').update({ followup_stage: nextStage, last_message_at: now.toISOString() }).eq('id', lead.id);
            results.push({ lead: lead.nombre, stage: nextStage });
          }
       }
    }

    // ==========================================
    // FLUJO 2: REACTIVACIÓN (LOW/MED INTENT)
    // ==========================================
    const { data: coldLeads } = await supabaseClient
      .from('leads')
      .select('*')
      .neq('buying_intent', 'ALTO')     // No molestar a los que ya están en cierre
      .neq('buying_intent', 'COMPRADO') // No molestar a clientes
      .neq('ai_paused', true)
      .eq('followup_stage', 0);         // Solo si NO han sido contactados aún (Stage 0)

    for (const lead of (coldLeads || [])) {
        const lastInteraction = new Date(lead.last_message_at || lead.created_at); 
        const diffHours = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);

        if (diffHours >= engagementDelayHours) {
            const namePart = lead.nombre && !lead.nombre.includes('Nuevo') ? ` ${lead.nombre}` : '';
            const msg = `Hola${namePart}, ¿pudiste revisar la información? Sigo pendiente por si tienes dudas o quieres saber fechas para tu ciudad.`;
            
            await sendMessage(supabaseClient, webhookUrl, lead, msg, 'AUTO_ENGAGEMENT');
            
            // Marcar como 'contactado' (Stage 1) para no volver a molestar
            await supabaseClient.from('leads').update({ 
                followup_stage: 1, 
                last_message_at: now.toISOString() 
            }).eq('id', lead.id);

            reactivated.push({ lead: lead.id });
        }
    }

    return new Response(JSON.stringify({ success: true, processed: results, reactivated: reactivated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})

async function sendMessage(supabase, webhookUrl, lead, text, platform) {
    await supabase.from('conversaciones').insert({
        lead_id: lead.id,
        emisor: 'SAMURAI',
        mensaje: text,
        platform: platform
    });

    if (webhookUrl) {
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'outgoing_message',
                    lead_id: lead.id,
                    phone: lead.telefono,
                    message: text,
                    kommo_id: lead.kommo_id,
                    source: 'samurai_auto'
                })
            });
        } catch (e) { console.error("Error webhook:", e); }
    }
}