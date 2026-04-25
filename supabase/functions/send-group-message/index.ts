import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { channel_id, group_jid, message, course_id, mediaData } = await req.json();

    if (!channel_id || !group_jid || (!message && !mediaData)) {
      return new Response(JSON.stringify({ error: 'channel_id, group_jid y (message o mediaData) requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Obtener datos del canal
    const { data: channel, error: chErr } = await supabase
      .from('whatsapp_channels')
      .select('api_url, api_key, instance_id, provider, name')
      .eq('id', channel_id)
      .single();

    if (chErr || !channel) {
      return new Response(JSON.stringify({ error: 'Canal no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (channel.provider !== 'gowa') {
      return new Response(JSON.stringify({ error: 'Solo canales GOWA soportan envío a grupos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = channel.api_key.startsWith('Basic ')
      ? channel.api_key
      : `Basic ${channel.api_key}`;

    const baseHeaders: Record<string, string> = {
      'Authorization': authHeader,
      'X-Device-Id': channel.instance_id ?? '',
    };

    let gowaRes: Response;

    if (mediaData?.url) {
      // --- Envío con media (imagen/video/audio) ---
      let downloadUrl = mediaData.url;
      // Comprimir imágenes de Supabase Storage via transform API
      if (mediaData.type === 'image' && downloadUrl.includes('/storage/v1/object/public/')) {
        downloadUrl = downloadUrl.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
        downloadUrl += (downloadUrl.includes('?') ? '&' : '?') + 'width=1200&quality=85';
      }

      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) {
        return new Response(JSON.stringify({ error: `No se pudo descargar media: ${fileRes.status}` }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const fileBlob = await fileRes.blob();
      const formData = new FormData();
      formData.append('phone', group_jid);
      if (message) formData.append('caption', message);

      let suffix = 'file';
      const urlPath = (mediaData.url || '').split('?')[0].toLowerCase();
      const isPng = urlPath.endsWith('.png');

      if (mediaData.type === 'image') {
        suffix = 'image';
        const fileName = isPng ? 'img.png' : 'img.jpg';
        formData.append('image', fileBlob, fileName);
      } else if (mediaData.type === 'video') {
        suffix = 'file';
        formData.append('file', fileBlob, mediaData.name || 'video.mp4');
      } else if (mediaData.type === 'audio') {
        suffix = 'file';
        formData.append('file', fileBlob, mediaData.name || 'audio.ogg');
      } else {
        suffix = 'file';
        formData.append('file', fileBlob, mediaData.name || 'document.pdf');
      }

      gowaRes = await fetch(`${channel.api_url}/send/${suffix}`, {
        method: 'POST',
        headers: baseHeaders, // No Content-Type — FormData lo pone automáticamente
        body: formData,
      });
    } else {
      // --- Envío solo texto ---
      gowaRes = await fetch(`${channel.api_url}/send/message`, {
        method: 'POST',
        headers: { ...baseHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: group_jid, message }),
      });
    }

    const gowaText = await gowaRes.text();
    let gowaData: unknown = gowaText;
    try { gowaData = JSON.parse(gowaText); } catch (_) { /* plain text */ }

    if (!gowaRes.ok) {
      console.error(`[send-group-message] GOWA ${gowaRes.status}: ${gowaText}`);
      return new Response(JSON.stringify({
        error: `GOWA API error: ${gowaRes.status}`,
        details: gowaText.substring(0, 200),
      }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log en activity_logs
    const mediaLabel = mediaData?.type ? ` [${mediaData.type}]` : '';
    await supabase.from('activity_logs').insert({
      action: 'CAMPAIGN_GROUP_SEND',
      resource: 'CAMPAIGNS',
      description: `Mensaje${mediaLabel} enviado al grupo ${group_jid} via ${channel.name}${course_id ? ` (curso: ${course_id})` : ''}`,
      status: 'OK',
      metadata: {
        channel_id,
        group_jid,
        course_id: course_id || null,
        message_length: (message || '').length,
        has_media: !!mediaData,
        media_type: mediaData?.type || null,
      },
    }).catch((err: unknown) => console.error('[send-group-message] Log error:', err));

    console.log(`[send-group-message] Enviado a grupo ${group_jid} via ${channel.name}${mediaLabel}`);

    return new Response(JSON.stringify({
      success: true,
      gowa_response: gowaData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-group-message] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
