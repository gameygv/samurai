import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * health-check-pipeline: Vigila que el pipeline completo esté funcionando.
 *
 * Ejecutar como cron cada 30 minutos.
 * Si detecta problemas CRITICAL, envía alerta WhatsApp a Gamey.
 *
 * Checks (en orden de prioridad):
 * 1. IA respondiendo — ¿hay respuestas IA cuando hay mensajes entrantes?
 * 2. Webhook recibiendo — ¿llegan mensajes de clientes?
 * 3. CAPI enviando — ¿hay eventos CAPI?
 * 4. Errores en cascada — ¿hay crashes repetidos?
 * 5. Canales activos — ¿están los canales UP?
 */

// Config
const ALERT_PHONE = '525646605824';  // Gamey
const ALERT_CHANNEL_ID = '6178ae72-2c3b-47c8-8ecd-1ba23cef698c';  // Developer (Gamey)
const HOURS_CHECK_IA = 1;              // Si hay msgs en última hora pero 0 respuestas IA → CRITICAL
const HOURS_CHECK_MESSAGES = 4;        // Si 0 msgs de clientes en 4h → WARN (puede ser hora nocturna)
const HOURS_CHECK_CAPI = 12;           // Si 0 eventos CAPI en 12h con actividad → WARN
const ERROR_THRESHOLD_1H = 5;          // Si hay 5+ errores iguales en 1h → CRITICAL
const COOLDOWN_MINUTES = 60;           // No enviar alertas más de 1 vez por hora

interface HealthCheck {
  name: string;
  status: 'OK' | 'WARN' | 'CRITICAL';
  detail: string;
  value?: number;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const checks: HealthCheck[] = [];
  const now = new Date();
  const forceAlert = req.headers.get('x-force-alert') === 'true';

  try {
    // ═══════════════════════════════════════════════════════
    // CHECK 1: IA RESPONDIENDO (más crítico — detecta el bug exacto de hoy)
    // ═══════════════════════════════════════════════════════
    const iaCheckCutoff = new Date(now.getTime() - HOURS_CHECK_IA * 60 * 60 * 1000).toISOString();

    const { count: clientMsgs1h } = await supabase
      .from('conversaciones')
      .select('id', { count: 'exact', head: true })
      .eq('emisor', 'CLIENTE')
      .gte('created_at', iaCheckCutoff);

    const { count: iaMsgs1h } = await supabase
      .from('conversaciones')
      .select('id', { count: 'exact', head: true })
      .eq('emisor', 'IA')
      .gte('created_at', iaCheckCutoff);

    const clientCount = clientMsgs1h ?? 0;
    const iaCount = iaMsgs1h ?? 0;

    if (clientCount >= 3 && iaCount === 0) {
      // Hay mensajes entrantes pero la IA no responde → CRASH
      checks.push({
        name: 'ia_responding',
        status: 'CRITICAL',
        detail: `🚨 IA MUERTA: ${clientCount} msgs de clientes en última hora pero 0 respuestas IA. Pipeline crasheando.`,
        value: 0,
      });
    } else if (clientCount >= 5 && iaCount < clientCount * 0.3) {
      // Menos del 30% de mensajes tienen respuesta IA
      checks.push({
        name: 'ia_responding',
        status: 'WARN',
        detail: `⚠️ IA lenta: solo ${iaCount}/${clientCount} mensajes respondidos en última hora (${Math.round(iaCount/clientCount*100)}%)`,
        value: Math.round(iaCount / clientCount * 100),
      });
    } else {
      checks.push({
        name: 'ia_responding',
        status: 'OK',
        detail: `IA OK: ${iaCount} respuestas / ${clientCount} mensajes en última hora`,
        value: clientCount > 0 ? Math.round(iaCount / clientCount * 100) : 100,
      });
    }

    // ═══════════════════════════════════════════════════════
    // CHECK 2: ERRORES EN CASCADA (detecta crashes repetidos)
    // ═══════════════════════════════════════════════════════
    const errorCutoff = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { data: recentErrors } = await supabase
      .from('activity_logs')
      .select('description')
      .eq('action', 'ERROR')
      .gte('created_at', errorCutoff)
      .limit(50);

    const errorCount = recentErrors?.length ?? 0;

    if (errorCount >= ERROR_THRESHOLD_1H) {
      // Agrupar errores por patrón (primeros 50 chars)
      const errorPatterns: Record<string, number> = {};
      (recentErrors || []).forEach(e => {
        const key = (e.description || '').substring(0, 60);
        errorPatterns[key] = (errorPatterns[key] || 0) + 1;
      });
      const topError = Object.entries(errorPatterns).sort((a, b) => b[1] - a[1])[0];

      checks.push({
        name: 'error_cascade',
        status: 'CRITICAL',
        detail: `🚨 ${errorCount} errores en última hora. Top: "${topError[0]}" (×${topError[1]})`,
        value: errorCount,
      });
    } else if (errorCount >= 3) {
      checks.push({
        name: 'error_cascade',
        status: 'WARN',
        detail: `${errorCount} errores en última hora`,
        value: errorCount,
      });
    } else {
      checks.push({
        name: 'error_cascade',
        status: 'OK',
        detail: `${errorCount} errores en última hora`,
        value: errorCount,
      });
    }

    // ═══════════════════════════════════════════════════════
    // CHECK 3: WEBHOOK RECIBIENDO MENSAJES
    // ═══════════════════════════════════════════════════════
    const msgCutoff = new Date(now.getTime() - HOURS_CHECK_MESSAGES * 60 * 60 * 1000).toISOString();
    const { count: recentMessages } = await supabase
      .from('conversaciones')
      .select('id', { count: 'exact', head: true })
      .eq('emisor', 'CLIENTE')
      .gte('created_at', msgCutoff);

    const msgCount = recentMessages ?? 0;

    // Solo alertar si estamos en horario activo (8:00-23:00 México)
    const mxHour = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' })).getHours();
    const isActiveHours = mxHour >= 8 && mxHour <= 23;

    if (msgCount === 0 && isActiveHours) {
      checks.push({
        name: 'webhook_messages',
        status: 'WARN',
        detail: `0 msgs de clientes en ${HOURS_CHECK_MESSAGES}h (horario activo). ¿Webhook caído?`,
        value: 0,
      });
    } else {
      checks.push({
        name: 'webhook_messages',
        status: 'OK',
        detail: `${msgCount} msgs de clientes en últimas ${HOURS_CHECK_MESSAGES}h`,
        value: msgCount,
      });
    }

    // ═══════════════════════════════════════════════════════
    // CHECK 4: CAPI ENVIANDO
    // ═══════════════════════════════════════════════════════
    const capiCutoff = new Date(now.getTime() - HOURS_CHECK_CAPI * 60 * 60 * 1000).toISOString();
    const { count: recentCapi } = await supabase
      .from('meta_capi_events')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', capiCutoff);

    const capiCount = recentCapi ?? 0;
    if (capiCount === 0 && msgCount > 10) {
      checks.push({
        name: 'capi_events',
        status: 'WARN',
        detail: `0 eventos CAPI en ${HOURS_CHECK_CAPI}h con ${msgCount} msgs activos`,
        value: 0,
      });
    } else {
      checks.push({
        name: 'capi_events',
        status: 'OK',
        detail: `${capiCount} eventos CAPI en últimas ${HOURS_CHECK_CAPI}h`,
        value: capiCount,
      });
    }

    // ═══════════════════════════════════════════════════════
    // CHECK 5: CANALES ACTIVOS
    // ═══════════════════════════════════════════════════════
    const { data: activeChannels } = await supabase
      .from('whatsapp_channels')
      .select('id, name, provider, ai_mode, is_active')
      .eq('is_active', true);

    checks.push({
      name: 'channels',
      status: (activeChannels?.length ?? 0) > 0 ? 'OK' : 'CRITICAL',
      detail: `${activeChannels?.length || 0} canales activos: ${(activeChannels || []).map(c => `${c.name}(${c.ai_mode})`).join(', ')}`,
    });

    // ═══════════════════════════════════════════════════════
    // RESULTADO GLOBAL + ALERTA WHATSAPP
    // ═══════════════════════════════════════════════════════
    const criticals = checks.filter(c => c.status === 'CRITICAL');
    const warnings = checks.filter(c => c.status === 'WARN');
    const overallStatus = criticals.length > 0 ? 'CRITICAL' : warnings.length > 0 ? 'WARN' : 'OK';

    // Log to activity_logs
    const logDesc = overallStatus === 'OK'
      ? `✅ Health OK: IA ${iaCount}/${clientCount} msgs, ${errorCount} errs, ${capiCount} CAPI`
      : overallStatus === 'WARN'
        ? `⚠️ Health WARN: ${warnings.map(c => c.detail).join(' | ')}`
        : `🚨 Health CRITICAL: ${criticals.map(c => c.detail).join(' | ')}`;

    await supabase.from('activity_logs').insert({
      action: 'HEALTH',
      resource: 'SYSTEM',
      description: logDesc.substring(0, 500),
      status: overallStatus === 'OK' ? 'OK' : 'ERROR',
    });

    // ALERTA WHATSAPP si es CRITICAL (con cooldown)
    if (overallStatus === 'CRITICAL' || forceAlert) {
      // Check cooldown: no enviar si ya se envió alerta en los últimos COOLDOWN_MINUTES
      const cooldownCutoff = new Date(now.getTime() - COOLDOWN_MINUTES * 60 * 1000).toISOString();
      const { count: recentAlerts } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('action', 'HEALTH_ALERT_SENT')
        .gte('created_at', cooldownCutoff);

      if ((recentAlerts ?? 0) === 0 || forceAlert) {
        // Construir mensaje de alerta
        const alertMsg = `🚨 *ALERTA SAMURAI*\n\n${criticals.map(c => c.detail).join('\n\n')}\n\n${warnings.length > 0 ? `⚠️ También: ${warnings.map(c => c.name).join(', ')}` : ''}\n\n_${now.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}_`;

        // Enviar via send-message-v3
        const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-message-v3`;
        const sendRes = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            channel_id: ALERT_CHANNEL_ID,
            phone: ALERT_PHONE,
            message: alertMsg,
          }),
        });

        const sendResult = await sendRes.json().catch(() => ({ success: false }));

        // Registrar que se envió alerta (para cooldown)
        await supabase.from('activity_logs').insert({
          action: 'HEALTH_ALERT_SENT',
          resource: 'SYSTEM',
          description: `📱 Alerta WhatsApp enviada a Gamey: ${sendResult.success ? 'OK' : 'FALLO'}`,
          status: sendResult.success ? 'OK' : 'ERROR',
        });
      }
    }

    const result = {
      status: overallStatus,
      timestamp: now.toISOString(),
      checks,
      summary: {
        critical: criticals.length,
        warnings: warnings.length,
        ok: checks.filter(c => c.status === 'OK').length,
      },
    };

    return new Response(JSON.stringify(result, null, 2), {
      status: overallStatus === 'CRITICAL' ? 503 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errMsg = String(err).substring(0, 200);
    console.error('[HEALTH] Fatal error:', err);

    // Intentar alerta incluso si el check falló
    try {
      await supabase.from('activity_logs').insert({
        action: 'HEALTH', resource: 'SYSTEM',
        description: `🚨 Health check CRASHED: ${errMsg}`,
        status: 'ERROR',
      });

      // Enviar alerta de crash
      const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-message-v3`;
      await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          channel_id: ALERT_CHANNEL_ID,
          phone: ALERT_PHONE,
          message: `🚨 *ALERTA SAMURAI*\n\nEl health-check mismo crasheó:\n${errMsg}\n\n_Revisar urgente_`,
        }),
      });
    } catch (_) { /* best effort */ }

    return new Response(JSON.stringify({ status: 'ERROR', error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
