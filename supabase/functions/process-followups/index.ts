// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  console.log("[process-followups] Iniciando ciclo...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date();

    // 1. OBTENER CONFIGURACIÓN
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key, defaultVal) => configs?.find(c => c.key === key)?.value || defaultVal;

    const delays = {
       1: parseInt(getConfig('sales_reminder_1', 24)), 
       2: parseInt(getConfig('sales_reminder_2', 48)), 
       3: parseInt(getConfig('sales_reminder_3', 72)), 
       4: parseInt(getConfig('sales_reminder_4', 7)) * 24   
    };
    const engagementDelayHours = parseInt(getConfig('engagement_reminder_hours', 24));
    
    // WooCommerce Links
    const wcUrl = getConfig('wc_url') || "https://theelephantbowl.com";
    const productId = getConfig('wc_product_id') || "1483"; 
    const bookingLink = `${wcUrl}/checkout/?add-to-cart=${productId}`;
    
    // Evolution API Config
    const evolutionApiUrl = getConfig('evolution_api_url', null);
    const evolutionApiKey = getConfig('evolution_api_key', null);

    const results = [];
    const reactivated = [];

    // --- HELPER PARA ENVÍO SEGURO ---
    const sendSafeMessage = async (lead, text, type) => {
        try {
            // 1. Guardar en DB
            await supabaseClient.from('conversaciones').insert({
                lead_id: lead.id,
                emisor: 'SAMURAI',
                mensaje: text,
                platform: 'AUTO_FOLLOWUP'
            });

            // 2. Enviar a Evolution API
            if (evolutionApiUrl && evolutionApiKey) {
                const res = await fetch(evolutionApiUrl, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'apikey': evolutionApiKey
                    },
                    body: JSON.stringify({
                        number: lead.telefono,
                        options: { delay: 1200, presence: 'composing' },
                        textMessage: { text: text },
                    })
                });
                if (!res.ok) {
                    const errorBody = await res.json();
                    throw new Error(`Evolution API status: ${res.status} - ${errorBody.message}`);
                }
            } else {
                console.warn(`[process-followups] Evolution API no configurada. Mensaje para ${lead.id} no enviado.`);
                // No lanzamos error para no detener el proceso, solo advertimos.
            }
            return true;
        } catch (e) {
            console.error(`[process-followups] Error enviando a ${lead.id}:`, e);
            await supabaseClient.from('activity_logs').insert({
                action: 'ERROR',
                resource: 'SYSTEM',
                description: `Fallo follow-up para ${lead.nombre}: ${e.message}`,
                status: 'ERROR'
            });
            return false;
        }
    };

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
       // Cálculo de tiempo: Usa last_message_at para detectar SILENCIO
       const lastInteraction = new Date(lead.last_message_at || lead.created_at); 
       const diffHours = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);
       const nextStage = (lead.followup_stage || 0) + 1;

       if (delays[nextStage] && diffHours >= delays[nextStage]) {
          let message = "";
          const citySuffix = lead.ciudad ? ` para el taller en ${lead.ciudad}` : " para el taller";

          switch (nextStage) {
            case 1: message = `Hola ${lead.nombre}, solo quería confirmar que recibieras bien el link de reserva${citySuffix}. ¿Tuviste oportunidad de verlo? Aquí te lo dejo: ${bookingLink}`; break;
            case 2: message = `Qué tal ${lead.nombre}, sigo guardando tu lugar${citySuffix}. ¿Hubo algún problema técnico con el pago? Si prefieres transferencia directa, avísame.`; break;
            case 3: message = `Hola ${lead.nombre}, te escribo porque el cupo${citySuffix} se está agotando. ¿Aún te interesa asegurar tu lugar o lo libero?`; break;
            case 4: message = `Atención ${lead.nombre}: El sistema me indica que no se completó tu reserva. Liberaré tu lugar hoy. Si deseas conservarlo, usa este link: ${bookingLink}`; break;
          }

          if (message) {
            const sent = await sendSafeMessage(lead, message, 'SALE_FOLLOWUP');
            if (sent) {
                await supabaseClient.from('leads').update({ followup_stage: nextStage, last_message_at: now.toISOString() }).eq('id', lead.id);
                results.push({ lead: lead.nombre, stage: nextStage });
            }
          }
       }
    }

    // ==========================================
    // FLUJO 2: REACTIVACIÓN (LOW/MED INTENT)
    // ==========================================
    const { data: coldLeads } = await supabaseClient
      .from('leads')
      .select('*')
      .neq('buying_intent', 'ALTO')
      .neq('buying_intent', 'COMPRADO')
      .neq('ai_paused', true)
      .eq('followup_stage', 0); // Solo stage 0

    for (const lead of (coldLeads || [])) {
        const lastInteraction = new Date(lead.last_message_at || lead.created_at); 
        const diffHours = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);

        if (diffHours >= engagementDelayHours) {
            const namePart = lead.nombre && !lead.nombre.includes('Nuevo') ? ` ${lead.nombre}` : '';
            const msg = `Hola${namePart}, ¿pudiste revisar la información? Sigo pendiente por si tienes dudas o quieres saber fechas para tu ciudad.`;
            
            const sent = await sendSafeMessage(lead, msg, 'ENGAGEMENT');
            if (sent) {
                // Stage 1 marca que ya hicimos el intento de reactivación
                await supabaseClient.from('leads').update({ 
                    followup_stage: 1, 
                    last_message_at: now.toISOString() 
                }).eq('id', lead.id);
                reactivated.push({ lead: lead.id });
            }
        }
    }

    return new Response(JSON.stringify({ success: true, processed: results, reactivated: reactivated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})