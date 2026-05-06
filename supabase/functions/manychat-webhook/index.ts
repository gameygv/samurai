import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { invokeFunction } from '../_shared/invoke.ts'

/**
 * manychat-webhook — Recibe External Requests de ManyChat (Messenger, Instagram DMs, comentarios).
 *
 * Flujo:
 * 1. ManyChat recibe mensaje/comentario en Messenger o Instagram
 * 2. Flow de ManyChat hace POST aquí con datos del subscriber + mensaje
 * 3. Esta función: busca/crea lead, guarda en conversaciones, lanza IA async
 * 4. process-samurai-response genera respuesta
 * 5. send-message-v3 envía respuesta de vuelta via ManyChat API
 *
 * ManyChat External Request tiene timeout de 10s — responder rápido.
 */

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json();

    // Validar secret
    const incomingSecret = req.headers.get('x-manychat-secret') || '';
    const { data: secretCfg } = await supabase.from('app_config')
      .select('value').eq('key', 'manychat_webhook_secret').maybeSingle();
    const expectedSecret = secretCfg?.value || '';
    if (expectedSecret && incomingSecret !== expectedSecret) {
      console.error('[manychat-webhook] Invalid secret');
      return new Response('unauthorized', { status: 401 });
    }

    const {
      type,              // 'message' | 'instagram_comment' | 'fb_comment'
      first_name,
      last_name,
      last_input_text,   // Texto del mensaje o comentario
      phone,
      email,
      gender,
      profile_pic,
      page_id,           // ManyChat page ID (identifica qué página/canal)
    } = body;

    // ManyChat usa "subscriber_id" para Messenger pero "id" para Instagram (Full Contact Data)
    const subscriber_id = body.subscriber_id || body.id;

    if (!subscriber_id) {
      return new Response(JSON.stringify({ status: 'error', message: 'subscriber_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const msgType = type || 'message';
    const text = last_input_text || '';
    const name = [first_name, last_name].filter(Boolean).join(' ') || 'Lead ManyChat';

    // Determinar plataforma
    // Detección: ?platform=instagram en URL, body.platform, body.channel, o type
    const urlPlatform = new URL(req.url).searchParams.get('platform');
    let platform = 'MESSENGER';
    if (msgType === 'instagram_comment') platform = 'INSTAGRAM_COMMENT';
    else if (msgType === 'fb_comment') platform = 'FB_COMMENT';
    else if (urlPlatform === 'instagram' || body.platform === 'instagram' || body.channel === 'ig') {
      platform = 'INSTAGRAM';
    }

    // Buscar canal ManyChat en whatsapp_channels (por page_id en instance_id)
    // Instagram usa instance_id = "{page_id}_ig" para distinguir del canal Messenger
    let channelId: string | null = null;
    if (page_id) {
      const instanceId = platform === 'INSTAGRAM' ? `${page_id}_ig` : String(page_id);
      const { data: ch } = await supabase.from('whatsapp_channels')
        .select('id, ai_mode').eq('instance_id', instanceId).eq('provider', 'manychat').maybeSingle();
      if (ch) {
        channelId = ch.id;
      } else if (platform === 'INSTAGRAM') {
        // Fallback: si no hay canal IG específico, usar el canal Messenger
        const { data: fbCh } = await supabase.from('whatsapp_channels')
          .select('id, ai_mode').eq('instance_id', String(page_id)).eq('provider', 'manychat').maybeSingle();
        if (fbCh) channelId = fbCh.id;
      }
      // Verificar ai_mode del canal encontrado
      if (channelId) {
        const { data: chMode } = await supabase.from('whatsapp_channels')
          .select('ai_mode').eq('id', channelId).maybeSingle();
        if (chMode?.ai_mode === 'off') {
          return new Response(JSON.stringify({ status: 'ok', action: 'channel_off' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }
    }

    // Buscar lead existente por manychat_subscriber_id, luego por teléfono
    let lead: Record<string, unknown> | null = null;
    const subId = String(subscriber_id);

    const { data: byMcId } = await supabase.from('leads')
      .select('*').eq('manychat_subscriber_id', subId).limit(1).maybeSingle();
    lead = byMcId;

    if (!lead && phone) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const { data: byPhone } = await supabase.from('leads')
          .select('*').or(`telefono.ilike.%${cleanPhone.slice(-10)}%`).limit(1).maybeSingle();
        if (byPhone) {
          lead = byPhone;
          // Vincular subscriber_id al lead existente
          await supabase.from('leads').update({ manychat_subscriber_id: subId }).eq('id', byPhone.id);
        }
      }
    }

    // Crear lead si no existe
    if (!lead) {
      // Determinar agente asignado via channel_agent_map
      let assignedAgent: string | null = null;
      if (channelId) {
        const { data: agentMapCfg } = await supabase.from('app_config')
          .select('value').eq('key', 'channel_agent_map').maybeSingle();
        if (agentMapCfg?.value) {
          try {
            const agentMap = JSON.parse(agentMapCfg.value);
            if (agentMap[channelId]) assignedAgent = agentMap[channelId];
          } catch (_) { /* ignore */ }
        }
      }

      const cleanPhone = phone ? phone.replace(/\D/g, '') : null;
      const leadInsert: Record<string, unknown> = {
        nombre: name,
        telefono: cleanPhone || `mc_${subId}`,
        channel_id: channelId,
        assigned_to: assignedAgent,
        manychat_subscriber_id: subId,
        buying_intent: 'BAJO',
        last_message_at: new Date().toISOString(),
        followup_stage: 0,
      };
      if (email) leadInsert.email = email;

      const { data: newLead, error: insertErr } = await supabase
        .from('leads').insert(leadInsert).select().single();

      if (insertErr) {
        console.error('[manychat-webhook] Lead insert error:', insertErr);
        return new Response(JSON.stringify({ status: 'error', message: 'lead_insert_failed' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      lead = newLead;

      const platformLabel = platform === 'INSTAGRAM' ? 'Instagram' :
        platform === 'INSTAGRAM_COMMENT' ? 'Instagram (comentario)' :
        platform === 'FB_COMMENT' ? 'Facebook (comentario)' : 'Messenger';

      await supabase.from('activity_logs').insert({
        action: 'CREATE', resource: 'LEADS',
        description: `Lead entrante via ${platformLabel}: ${name}. Etapa BAJO.`,
        status: 'OK'
      });
    } else {
      // Actualizar datos del lead existente si faltan
      const updates: Record<string, unknown> = { last_message_at: new Date().toISOString() };
      if (!lead.manychat_subscriber_id) updates.manychat_subscriber_id = subId;
      if (email && !lead.email) updates.email = email;
      if (phone && !lead.telefono) updates.telefono = phone.replace(/\D/g, '');
      await supabase.from('leads').update(updates).eq('id', lead.id);
    }

    // Anti-eco: si el texto es idéntico a la última respuesta IA (dentro de 30s), ignorar
    // ManyChat puede reenviar la respuesta del bot como si fuera un mensaje nuevo
    if (text && lead.id) {
      const { data: recentIA } = await supabase.from('conversaciones')
        .select('mensaje').eq('lead_id', lead.id).eq('emisor', 'IA')
        .gte('created_at', new Date(Date.now() - 30000).toISOString())
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (recentIA && recentIA.mensaje && text.trim() === recentIA.mensaje.trim()) {
        return new Response(JSON.stringify({ status: 'ok', action: 'echo_skipped' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Guardar mensaje en conversaciones
    if (text) {
      await supabase.from('conversaciones').insert({
        lead_id: lead.id,
        mensaje: text,
        emisor: 'CLIENTE',
        platform,
        metadata: { source: 'manychat', subscriber_id: subId, page_id, type: msgType }
      });
    }

    // Para comentarios: solo guardar, no lanzar IA (los comentarios son públicos)
    if (msgType === 'instagram_comment' || msgType === 'fb_comment') {
      await supabase.from('activity_logs').insert({
        action: 'CHAT', resource: 'SYSTEM',
        description: `💬 Comentario ${msgType === 'instagram_comment' ? 'IG' : 'FB'} de ${name}: "${(text || '').substring(0, 40)}..."`,
        status: 'OK'
      });

      return new Response(JSON.stringify({
        status: 'ok',
        action: 'comment_saved',
        samurai_lead_id: lead.id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Para mensajes directos: lanzar IA async (si canal está en modo 'on')
    // Verificar ai_mode del canal
    let aiMode = 'on';
    if (channelId) {
      const { data: chCfg } = await supabase.from('whatsapp_channels')
        .select('ai_mode').eq('id', channelId).maybeSingle();
      aiMode = chCfg?.ai_mode || 'on';
    }

    // Log del mensaje
    await supabase.from('activity_logs').insert({
      action: 'CHAT', resource: 'SYSTEM',
      description: `Mensaje ${platform} de ${name}: "${(text || '').substring(0, 30)}..."`,
      status: 'OK'
    });

    // Análisis de lead (extracción de datos + CAPI) — siempre en on y monitor
    if (text && text !== '[Mensaje]') {
      invokeFunction({
        functionName: 'analyze-leads',
        body: { lead_id: lead.id },
        supabase, errorContext: `manychat ${name}`,
      });
    }

    // IA response — solo si modo 'on'
    if (aiMode === 'on' && text) {
      invokeFunction({
        functionName: 'process-samurai-response',
        body: { lead_id: lead.id, client_message: text },
        supabase, errorContext: `manychat AI ${name}`,
      });
    }

    // Responder a ManyChat con lead_id (para mapear en Custom Field)
    return new Response(JSON.stringify({
      status: 'ok',
      action: aiMode === 'on' ? 'ai_processing' : 'monitored',
      samurai_lead_id: String(lead.id),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[manychat-webhook] Error:', err);
    return new Response(JSON.stringify({ status: 'error', message: String(err) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
