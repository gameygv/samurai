// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  console.log("[process-credit-reminders] Iniciando Motor de Cobranza Automática...");

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // 1. OBTENER PARCIALIDADES PENDIENTES
    // Se extrae información de la venta, del contacto y del responsable asignado.
    const { data: installments, error: fetchErr } = await supabaseClient
      .from('credit_installments')
      .select(`
         id, amount, due_date, status, 
         sale:credit_sales(id, concept, reminder_days_before, overdue_reminder_interval, msg_template_client, msg_template_agent, responsible_id, contact:contacts(id, nombre, telefono, lead_id))
      `)
      .in('status', ['PENDING', 'LATE']);

    if (fetchErr) throw fetchErr;

    if (!installments || installments.length === 0) {
       return new Response(JSON.stringify({ message: "No hay parcialidades pendientes de revisar." }), { headers: corsHeaders });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    let messagesSent = 0;

    for (const inst of installments) {
       const sale = inst.sale;
       if (!sale || !sale.contact) continue;

       const dueDate = new Date(inst.due_date);
       const diffTime = dueDate.getTime() - todayDate.getTime();
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Positivo = Faltan días, Negativo = Atrasado, 0 = Hoy

       const clientName = sale.contact.nombre?.split(' ')[0] || 'Cliente';
       const amountStr = `$${Number(inst.amount).toLocaleString()}`;
       const dateStr = inst.due_date;

       let shouldRemindClient = false;
       let shouldRemindAgent = false;
       let isOverdue = diffDays < 0;

       // A. LOGICA DE AVISO PREVIO O DÍA EXACTO
       if (diffDays >= 0) {
           const triggerDays = sale.reminder_days_before || [1];
           if (triggerDays.includes(diffDays) || diffDays === 0) {
               shouldRemindClient = true;
               shouldRemindAgent = true;
           }
       } 
       // B. LOGICA DE ATRASO (OVERDUE)
       else if (isOverdue) {
           // Actualizar status a LATE si no lo estaba
           if (inst.status === 'PENDING') {
               await supabaseClient.from('credit_installments').update({ status: 'LATE' }).eq('id', inst.id);
           }
           
           const daysLate = Math.abs(diffDays);
           const interval = sale.overdue_reminder_interval || 3;
           
           // Enviar si es múltiplo del intervalo (ej: cada 3 días de atraso)
           if (daysLate % interval === 0) {
               shouldRemindClient = true;
               shouldRemindAgent = true;
           }
       }

       if (!shouldRemindClient && !shouldRemindAgent) continue;

       // PREPARAR TEXTOS
       let finalClientMsg = sale.msg_template_client;
       if (isOverdue) {
           finalClientMsg = `⚠️ Hola ${clientName}, notamos que tienes un saldo vencido de *${amountStr}* desde el *${dateStr}*. Por favor, contáctanos para regularizar tu situación.`;
       } else if (diffDays === 0) {
           finalClientMsg = `¡Hola ${clientName}! Este es un recordatorio de que *HOY* vence tu pago de *${amountStr}* correspondiente a: ${sale.concept}.`;
       }
       finalClientMsg = finalClientMsg.replace(/{nombre}/g, clientName).replace(/{monto}/g, amountStr).replace(/{fecha}/g, dateStr);

       let finalAgentMsg = sale.msg_template_agent;
       if (isOverdue) {
           finalAgentMsg = `🚨 ALERTA ROJA COBRANZA: El cliente *${clientName}* tiene un ATRASO de ${Math.abs(diffDays)} días por *${amountStr}*.`;
       } else if (diffDays === 0) {
           finalAgentMsg = `💰 HOY VENCE el pago de *${amountStr}* del cliente *${clientName}*.`;
       }
       finalAgentMsg = finalAgentMsg.replace(/{nombre}/g, clientName).replace(/{monto}/g, amountStr).replace(/{fecha}/g, dateStr);

       // 1. ENVIAR A CLIENTE
       if (shouldRemindClient && sale.contact.telefono) {
           await supabaseClient.functions.invoke('send-message-v3', {
               body: { phone: sale.contact.telefono, message: finalClientMsg }
           });
           messagesSent++;
       }

       // 2. ENVIAR AL AGENTE
       if (shouldRemindAgent && sale.responsible_id) {
           const { data: agentProfile } = await supabaseClient.from('profiles').select('phone').eq('id', sale.responsible_id).single();
           if (agentProfile?.phone) {
               await supabaseClient.functions.invoke('send-message-v3', {
                   body: { phone: agentProfile.phone, message: finalAgentMsg }
               });
               messagesSent++;
           }
       }

       // Actualizar última fecha de recordatorio
       await supabaseClient.from('credit_installments').update({ reminder_sent_at: new Date().toISOString() }).eq('id', inst.id);
    }

    return new Response(JSON.stringify({ success: true, messagesSent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("[Cobranza Error]:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})