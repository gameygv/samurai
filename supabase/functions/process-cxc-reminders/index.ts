// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * process-cxc-reminders
 *
 * Runs daily via pg_cron. Checks cxc_plan_pagos for cuotas due tomorrow
 * where the parent cxc has recordatorio_activo = true.
 *
 * Sends WhatsApp reminders via send-message-v3 to:
 * 1. The client (contacts.telefono)
 * 2. The assigned sales agent (profiles.phone via contacts.lead_id → leads.assigned_to)
 *
 * Uses the default_notification_channel (canal de alertas) from app_config.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  console.log("[process-cxc-reminders] Verificando recordatorios de CxC...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Calculate tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    console.log(`[CxC] Buscando cuotas con vencimiento: ${tomorrowStr}`);

    // Get unpaid plan_pagos due tomorrow where CxC has reminders enabled
    const { data: cuotas, error: fetchErr } = await supabaseClient
      .from('cxc_plan_pagos')
      .select('id, cxc_id, numero_cuota, monto, fecha_vencimiento')
      .eq('pagado', false)
      .eq('fecha_vencimiento', tomorrowStr);

    if (fetchErr) throw fetchErr;

    if (!cuotas || cuotas.length === 0) {
      console.log("[CxC] No hay cuotas por vencer manana.");
      return new Response(JSON.stringify({ message: "No hay cuotas por vencer manana.", sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get the CxC records to check recordatorio_activo and get client info
    const cxcIds = [...new Set(cuotas.map(c => c.cxc_id))];
    const { data: cxcs } = await supabaseClient
      .from('cxc')
      .select('id, folio, folio_display, cliente_id, cliente_nombre, recordatorio_activo, total, saldo')
      .in('id', cxcIds);

    if (!cxcs) {
      return new Response(JSON.stringify({ message: "No se encontraron CxC.", sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Filter only those with reminders enabled
    const activeCxcs = new Map(cxcs.filter(c => c.recordatorio_activo).map(c => [c.id, c]));

    if (activeCxcs.size === 0) {
      console.log("[CxC] Ninguna CxC tiene recordatorios activos.");
      return new Response(JSON.stringify({ message: "Ninguna CxC tiene recordatorios activos.", sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get client phones from contacts
    const clienteIds = [...new Set([...activeCxcs.values()].filter(c => c.cliente_id).map(c => c.cliente_id))];
    let clientPhoneMap = new Map();
    let clientLeadMap = new Map();

    if (clienteIds.length > 0) {
      const { data: contacts } = await supabaseClient
        .from('contacts')
        .select('id, telefono, lead_id')
        .in('id', clienteIds);

      if (contacts) {
        for (const c of contacts) {
          if (c.telefono) clientPhoneMap.set(c.id, c.telefono);
          if (c.lead_id) clientLeadMap.set(c.id, c.lead_id);
        }
      }
    }

    // Get agent phones: contacts.lead_id → leads.assigned_to → profiles.phone
    let agentPhoneMap = new Map(); // clienteId → agentPhone
    const leadIds = [...new Set([...clientLeadMap.values()])];

    if (leadIds.length > 0) {
      const { data: leads } = await supabaseClient
        .from('leads')
        .select('id, assigned_to')
        .in('id', leadIds);

      if (leads) {
        const agentIds = [...new Set(leads.filter(l => l.assigned_to).map(l => l.assigned_to))];

        if (agentIds.length > 0) {
          const { data: profiles } = await supabaseClient
            .from('profiles')
            .select('id, phone, full_name')
            .in('id', agentIds);

          const profileMap = new Map((profiles || []).map(p => [p.id, { phone: p.phone, name: p.full_name }]));
          const leadAgentMap = new Map(leads.map(l => [l.id, l.assigned_to]));

          // Map clienteId → agent info
          for (const [clienteId, leadId] of clientLeadMap) {
            const agentId = leadAgentMap.get(leadId);
            if (agentId) {
              const agent = profileMap.get(agentId);
              if (agent?.phone) {
                agentPhoneMap.set(clienteId, agent);
              }
            }
          }
        }
      }
    }

    // Check for already sent reminders today to avoid duplicates
    const cuotaIds = cuotas.filter(c => activeCxcs.has(c.cxc_id)).map(c => c.id);
    const { data: sentToday } = await supabaseClient
      .from('cxc_recordatorios_log')
      .select('cxc_plan_pago_id')
      .in('cxc_plan_pago_id', cuotaIds)
      .gte('created_at', todayStr + 'T00:00:00');

    const alreadySent = new Set((sentToday || []).map(s => s.cxc_plan_pago_id));

    let messagesSent = 0;

    for (const cuota of cuotas) {
      const cxc = activeCxcs.get(cuota.cxc_id);
      if (!cxc) continue; // Reminder not active
      if (alreadySent.has(cuota.id)) continue; // Already sent today

      const clienteName = cxc.cliente_nombre || 'Cliente';
      const montoStr = `$${Number(cuota.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
      const folioStr = cxc.folio_display || cxc.folio;
      const fechaStr = new Date(cuota.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-MX', {
        day: '2-digit', month: 'long', year: 'numeric'
      });

      // Message for client
      const msgCliente = `Hola ${clienteName.split(' ')[0]}, te recordamos que manana ${fechaStr} vence tu cuota #${cuota.numero_cuota} por ${montoStr} (Nota #${folioStr}). Gracias por tu preferencia. — The Elephant Bowl`;

      // Send to client
      const clientPhone = cxc.cliente_id ? clientPhoneMap.get(cxc.cliente_id) : null;
      if (clientPhone) {
        try {
          await supabaseClient.functions.invoke('send-message-v3', {
            body: { phone: clientPhone, message: msgCliente }
          });
          await supabaseClient.from('cxc_recordatorios_log').insert({
            cxc_plan_pago_id: cuota.id, tipo: 'cliente', telefono: clientPhone, mensaje: msgCliente, status: 'enviado'
          });
          messagesSent++;
          console.log(`[CxC] Recordatorio enviado a cliente ${clienteName} (${clientPhone})`);
        } catch (err) {
          console.error(`[CxC] Error enviando a cliente:`, err);
          await supabaseClient.from('cxc_recordatorios_log').insert({
            cxc_plan_pago_id: cuota.id, tipo: 'cliente', telefono: clientPhone, mensaje: msgCliente, status: 'error', error_detail: err.message
          });
        }
      }

      // Send to assigned agent
      const agent = cxc.cliente_id ? agentPhoneMap.get(cxc.cliente_id) : null;
      if (agent?.phone) {
        const saldoStr = `$${Number(cxc.saldo).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
        const msgAgente = `Recordatorio CxC: Tu cliente ${clienteName} tiene cuota #${cuota.numero_cuota} por ${montoStr} que vence manana ${fechaStr}. Saldo total pendiente: ${saldoStr}. Nota #${folioStr}.`;

        try {
          await supabaseClient.functions.invoke('send-message-v3', {
            body: { phone: agent.phone, message: msgAgente }
          });
          await supabaseClient.from('cxc_recordatorios_log').insert({
            cxc_plan_pago_id: cuota.id, tipo: 'agente', telefono: agent.phone, mensaje: msgAgente, status: 'enviado'
          });
          messagesSent++;
          console.log(`[CxC] Recordatorio enviado a agente ${agent.name} (${agent.phone})`);
        } catch (err) {
          console.error(`[CxC] Error enviando a agente:`, err);
          await supabaseClient.from('cxc_recordatorios_log').insert({
            cxc_plan_pago_id: cuota.id, tipo: 'agente', telefono: agent.phone, mensaje: msgAgente, status: 'error', error_detail: err.message
          });
        }
      }
    }

    console.log(`[CxC] Proceso completado. Mensajes enviados: ${messagesSent}`);
    return new Response(JSON.stringify({ success: true, messagesSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("[CxC Error]:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: corsHeaders
    });
  }
})
