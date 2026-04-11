// @ts-nocheck
// media-proxy — sirve audio/imagen de WhatsApp al navegador descargando con
// las credenciales del canal (Meta Graph / Gowa Basic / Evolution directa).
// Permite que <audio src> y <img src> funcionen en el navegador sin exponer api_keys.
//
// GET /media-proxy?message_id=<wamid>&lead_id=<uuid>
//
// Flujo:
//   1. Busca la conversación por message_id
//   2. Lee metadata.mediaId (Meta) o metadata.mediaUrl (Gowa/Evolution) + channel_id del lead
//   3. Descarga el blob con auth del canal
//   4. Devuelve el blob con Content-Type correcto + cache 1h

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const url = new URL(req.url);
    const messageId = url.searchParams.get('message_id');
    const leadId = url.searchParams.get('lead_id');
    if (!messageId || !leadId) {
      return new Response('missing_params', { status: 400, headers: CORS });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Buscar conversación + lead
    const { data: conv } = await supabase
      .from('conversaciones')
      .select('metadata')
      .eq('message_id', messageId)
      .eq('lead_id', leadId)
      .maybeSingle();

    if (!conv?.metadata) return new Response('not_found', { status: 404, headers: CORS });

    const meta = conv.metadata as any;
    const mediaUrl: string | null = meta.mediaUrl || null;
    const mediaId: string | null = meta.mediaId || null;
    const mediaType: string = meta.mediaType || 'application/octet-stream';

    if (!mediaUrl && !mediaId) return new Response('no_media', { status: 404, headers: CORS });

    // 2. Obtener canal del lead
    const { data: lead } = await supabase
      .from('leads')
      .select('channel_id')
      .eq('id', leadId)
      .maybeSingle();

    if (!lead?.channel_id) return new Response('no_channel', { status: 404, headers: CORS });

    const { data: channel } = await supabase
      .from('whatsapp_channels')
      .select('api_key, provider, api_url, instance_id')
      .eq('id', lead.channel_id)
      .single();

    if (!channel) return new Response('no_channel', { status: 404, headers: CORS });

    // 3. Descargar el blob según provider
    let mediaRes: Response;

    if (mediaId && (channel.provider === 'meta' || !mediaUrl)) {
      // Meta Graph API (2 pasos)
      const r1 = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${channel.api_key}` }
      });
      if (!r1.ok) return new Response(`meta_lookup_failed_${r1.status}`, { status: 502, headers: CORS });
      const r1j = await r1.json();
      if (!r1j.url) return new Response('meta_no_url', { status: 502, headers: CORS });
      mediaRes = await fetch(r1j.url, {
        headers: { 'Authorization': `Bearer ${channel.api_key}` }
      });
    } else if (mediaUrl && channel.provider === 'gowa') {
      // Gowa: Basic auth
      const headers: Record<string, string> = {};
      if (channel.api_key) {
        headers['Authorization'] = channel.api_key.startsWith('Basic ')
          ? channel.api_key
          : `Basic ${channel.api_key}`;
      }
      if (channel.instance_id) headers['X-Device-Id'] = channel.instance_id;
      mediaRes = await fetch(mediaUrl, { headers });
    } else if (mediaUrl) {
      // Evolution / URL pública
      mediaRes = await fetch(mediaUrl);
    } else {
      return new Response('no_downloadable_source', { status: 404, headers: CORS });
    }

    if (!mediaRes.ok) {
      return new Response(`upstream_${mediaRes.status}`, { status: 502, headers: CORS });
    }

    const blob = await mediaRes.arrayBuffer();

    // Heurística Content-Type por mediaType + extensión del URL
    let contentType = mediaRes.headers.get('content-type') || '';
    if (!contentType || contentType === 'application/octet-stream') {
      if (mediaType === 'audio') contentType = 'audio/ogg';
      else if (mediaType === 'image') contentType = 'image/jpeg';
      else if (mediaType === 'video') contentType = 'video/mp4';
      else contentType = 'application/octet-stream';
    }

    return new Response(blob, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Accept-Ranges': 'bytes',
      }
    });
  } catch (err) {
    console.error('[media-proxy] crash:', err);
    return new Response(`crash: ${err.message}`, { status: 500, headers: CORS });
  }
});
