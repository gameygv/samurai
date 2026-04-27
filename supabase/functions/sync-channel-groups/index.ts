import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GowaGroup {
  JID: string;
  Name: string;
  Topic: string;
  Participants: unknown[];
  ParticipantCount: number;
}

async function listGroupsFromGowa(channel: {
  api_url: string;
  api_key: string;
  instance_id: string;
}): Promise<{ jid: string; name: string; participant_count: number }[]> {
  const authHeader = channel.api_key.startsWith('Basic ')
    ? channel.api_key
    : `Basic ${channel.api_key}`;

  const res = await fetch(`${channel.api_url}/user/my/groups`, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'X-Device-Id': channel.instance_id ?? '',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GOWA ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const rawGroups: GowaGroup[] = data?.results?.data || [];

  return rawGroups.map((g) => ({
    jid: g.JID,
    name: g.Name || g.Topic || 'Sin nombre',
    participant_count: g.Participants?.length || g.ParticipantCount || 0,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json().catch(() => ({}));
    const targetChannelId: string | undefined = body.channel_id;

    // Obtener canales activos GOWA
    let channelQuery = supabase
      .from('whatsapp_channels')
      .select('id, name, provider, instance_id, api_url, api_key')
      .eq('provider', 'gowa')
      .eq('is_active', true);

    if (targetChannelId) {
      channelQuery = channelQuery.eq('id', targetChannelId);
    }

    const { data: channels, error: chErr } = await channelQuery;
    if (chErr || !channels) {
      return new Response(JSON.stringify({ error: 'Error cargando canales' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const runStartedAt = new Date().toISOString();
    let groupsUpserted = 0;
    let groupsMarkedStale = 0;
    const errors: { channel_id: string; channel_name: string; message: string }[] = [];

    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      try {
        // Llamar a GOWA directamente (mismo patrón que list-whatsapp-groups)
        const groups = await listGroupsFromGowa({
          api_url: channel.api_url,
          api_key: channel.api_key,
          instance_id: channel.instance_id,
        });

        // UPSERT grupos en cache
        for (const g of groups) {
          const { error: upsertErr } = await supabase
            .from('whatsapp_groups_cache')
            .upsert(
              {
                channel_id: channel.id,
                jid: g.jid,
                name: g.name,
                member_count: g.participant_count,
                last_synced_at: runStartedAt,
                is_active: true,
              },
              { onConflict: 'channel_id,jid', ignoreDuplicates: false }
            );

          if (!upsertErr) groupsUpserted++;
          else console.error(`[sync-channel-groups] Upsert error: ${upsertErr.message}`);
        }

        // Marcar stale: grupos que NO vinieron en esta respuesta
        // SOLO si el canal respondió exitosamente
        const { count: staleCount } = await supabase
          .from('whatsapp_groups_cache')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('channel_id', channel.id)
          .eq('is_active', true)
          .lt('last_synced_at', runStartedAt)
          .select('id', { count: 'exact', head: true });

        groupsMarkedStale += staleCount || 0;

        console.log(`[sync-channel-groups] ${channel.name}: ${groups.length} grupos synced`);
      } catch (err) {
        const msg = (err as Error).message;
        console.error(`[sync-channel-groups] ${channel.name} error: ${msg}`);
        errors.push({ channel_id: channel.id, channel_name: channel.name, message: msg });
      }

      // Sleep 1s entre canales
      if (i < channels.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Log en activity_logs
    const { error: logErr } = await supabase.from('activity_logs').insert({
      action: 'SYNC_CHANNEL_GROUPS',
      resource: 'CHANNELS',
      description: `Sync: ${channels.length} canales, ${groupsUpserted} upserted, ${groupsMarkedStale} stale, ${errors.length} errores`,
      status: errors.length === 0 ? 'OK' : 'WARNING',
      metadata: {
        channels_processed: channels.length,
        channels_failed: errors.length,
        groups_upserted: groupsUpserted,
        groups_marked_stale: groupsMarkedStale,
        errors,
        target_channel_id: targetChannelId || null,
      },
    });
    if (logErr) console.error('[sync-channel-groups] Log error:', logErr.message);

    return new Response(JSON.stringify({
      ok: true,
      ran_at: runStartedAt,
      channels_processed: channels.length,
      channels_failed: errors.length,
      groups_upserted: groupsUpserted,
      groups_marked_stale: groupsMarkedStale,
      errors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[sync-channel-groups] Error:', (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
