import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { channel_id, group_jid, message, course_id } = await req.json();

    if (!channel_id || !group_jid || !message) {
      return new Response(JSON.stringify({ error: 'channel_id, group_jid y message requeridos' }), {
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

    // Enviar mensaje al grupo via GOWA
    const authHeader = channel.api_key.startsWith('Basic ')
      ? channel.api_key
      : `Basic ${channel.api_key}`;

    const gowaRes = await fetch(`${channel.api_url}/send/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'X-Device-Id': channel.instance_id ?? '',
      },
      body: JSON.stringify({
        phone: group_jid,
        message: message,
      }),
    });

    const gowaText = await gowaRes.text();
    let gowaData: any = gowaText;
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
    await supabase.from('activity_logs').insert({
      action: 'CAMPAIGN_GROUP_SEND',
      resource: 'CAMPAIGNS',
      description: `Mensaje enviado al grupo ${group_jid} via ${channel.name}${course_id ? ` (curso: ${course_id})` : ''}`,
      status: 'OK',
      metadata: {
        channel_id,
        group_jid,
        course_id: course_id || null,
        message_length: message.length,
      },
    }).catch((err: any) => console.error('[send-group-message] Log error:', err));

    console.log(`[send-group-message] Enviado a grupo ${group_jid} via ${channel.name}`);

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
