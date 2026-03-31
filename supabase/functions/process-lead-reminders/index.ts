// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  console.log("[process-lead-reminders] Revisando recordatorios pendientes...");

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // 1. Buscar leads con reminders y agente asignado
    const { data: leads, error: fetchErr } = await supabase
      .from('leads')
      .select('id, nombre, assigned_to, reminders')
      .not('reminders', 'eq', '[]')
      .not('assigned_to', 'is', null);

    if (fetchErr) throw fetchErr;

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ message: "Sin recordatorios pendientes." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const now = new Date();
    let sent = 0;
    let skipped = 0;

    for (const lead of leads) {
      const reminders = Array.isArray(lead.reminders) ? lead.reminders : [];
      let updated = false;

      for (const rem of reminders) {
        // Saltar ya enviados o sin WhatsApp
        if (rem.sent) continue;
        if (!rem.notify_wa) continue;
        if (!rem.datetime) continue;

        // Calcular momento de disparo: datetime - notify_minutes
        const triggerTime = new Date(rem.datetime);
        triggerTime.setMinutes(triggerTime.getMinutes() - (rem.notify_minutes || 0));

        if (now < triggerTime) continue; // Aun no es hora

        // Buscar telefono del agente
        const { data: agent } = await supabase
          .from('profiles')
          .select('phone, full_name')
          .eq('id', lead.assigned_to)
          .single();

        if (!agent?.phone) {
          console.warn(`[lead-reminders] Agente ${lead.assigned_to} sin telefono, skip reminder para lead ${lead.nombre}`);
          await supabase.from('activity_logs').insert({
            action: 'ERROR', resource: 'SYSTEM',
            description: `📋 Recordatorio "${rem.title}" para ${lead.nombre}: agente sin telefono configurado`,
            status: 'ERROR'
          });
          rem.sent = true;
          rem.sent_at = now.toISOString();
          rem.error = 'agent_no_phone';
          updated = true;
          skipped++;
          continue;
        }

        // Enviar al agente por canal de notificaciones (sin lead_id = usa default_notification_channel)
        const msg = `📋 Recordatorio: ${rem.title}\n👤 Lead: ${lead.nombre}\n⏰ Programado: ${rem.datetime}`;
        try {
          await supabase.functions.invoke('send-message-v3', {
            body: { phone: agent.phone, message: msg }
          });
          sent++;
        } catch (sendErr) {
          console.error(`[lead-reminders] Error enviando a ${agent.full_name}:`, sendErr);
          await supabase.from('activity_logs').insert({
            action: 'ERROR', resource: 'SYSTEM',
            description: `📋 Recordatorio fallido para ${agent.full_name}: ${sendErr.message?.substring(0, 150)}`,
            status: 'ERROR'
          });
        }

        // Marcar como enviado
        rem.sent = true;
        rem.sent_at = now.toISOString();
        updated = true;
      }

      // Actualizar reminders del lead si cambio algo
      if (updated) {
        await supabase.from('leads').update({ reminders }).eq('id', lead.id);
      }
    }

    // Log resumen
    if (sent > 0 || skipped > 0) {
      await supabase.from('activity_logs').insert({
        action: 'UPDATE', resource: 'SYSTEM',
        description: `📋 Recordatorios procesados: ${sent} enviados, ${skipped} sin telefono de agente`,
        status: 'OK'
      });
    }

    return new Response(JSON.stringify({ success: true, sent, skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("[lead-reminders] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})
