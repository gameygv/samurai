import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { channel_id } = await req.json();
    if (!channel_id) {
      return new Response(JSON.stringify({ error: 'channel_id requerido' }), {
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
      return new Response(JSON.stringify({ error: 'Solo canales GOWA soportan grupos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Llamar a GOWA API
    const authHeader = channel.api_key.startsWith('Basic ')
      ? channel.api_key
      : `Basic ${channel.api_key}`;

    const gowaRes = await fetch(`${channel.api_url}/user/my/groups`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'X-Device-Id': channel.instance_id ?? '',
      },
    });

    if (!gowaRes.ok) {
      const errText = await gowaRes.text();
      console.error(`[list-whatsapp-groups] GOWA ${gowaRes.status}: ${errText}`);
      return new Response(JSON.stringify({ error: `GOWA API error: ${gowaRes.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gowaData = await gowaRes.json();
    const rawGroups = gowaData?.results?.data || [];

    // Mapear a formato limpio
    const groups = rawGroups.map((g: any) => ({
      jid: g.JID,
      name: g.Name || g.Topic || 'Sin nombre',
      participant_count: g.Participants?.length || g.ParticipantCount || 0,
      created_at: g.GroupCreated || null,
    }));

    return new Response(JSON.stringify({ groups, channel_name: channel.name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[list-whatsapp-groups] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
