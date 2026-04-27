import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { invokeFunction } from '../_shared/invoke.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Cron: sincroniza miembros de TODOS los grupos activos en whatsapp_groups_cache.
 * Llama sync-group-members para cada grupo, con pausa entre cada uno para no saturar GOWA.
 * Se ejecuta cada hora via cron de Supabase.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Get all active groups with their channel_id and optional course_id
    const { data: groups, error } = await supabase
      .from('whatsapp_groups_cache')
      .select('jid, channel_id, course_id')
      .eq('is_active', true)
      .order('last_synced_at', { ascending: true, nullsFirst: true })
      .limit(15); // Process max 15 groups per run (2s delay each ≈ 30s + sync time)

    if (error || !groups) {
      console.error('[cron-sync-all-groups] Error fetching groups:', error);
      return new Response(JSON.stringify({ error: error?.message || 'No groups' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let synced = 0;
    let failed = 0;
    const results: Array<{ jid: string; status: string; matched?: number }> = [];

    for (const group of groups) {
      try {
        const result = await invokeFunction({
          functionName: 'sync-group-members',
          body: {
            channel_id: group.channel_id,
            group_jid: group.jid,
            course_id: group.course_id || null,
          },
          supabase,
          errorContext: `cron-sync group=${group.jid}`,
          await: true,
        });

        // Update last_synced_at in cache
        await supabase
          .from('whatsapp_groups_cache')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('jid', group.jid);

        synced++;
        results.push({ jid: group.jid, status: 'ok', matched: result?.matched });
      } catch (err) {
        failed++;
        results.push({ jid: group.jid, status: 'error' });
        console.error(`[cron-sync-all-groups] Failed ${group.jid}:`, err);
      }

      // Pause 2s between groups to not overwhelm GOWA API
      if (groups.indexOf(group) < groups.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    await supabase.from('activity_logs').insert({
      action: 'INFO',
      resource: 'SYSTEM',
      description: `🔄 Cron sync grupos: ${synced} OK, ${failed} error de ${groups.length} grupos`,
      status: failed === 0 ? 'OK' : 'PARTIAL',
    });

    console.log(`[cron-sync-all-groups] Done: ${synced}/${groups.length} synced, ${failed} failed`);

    return new Response(JSON.stringify({ total: groups.length, synced, failed, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[cron-sync-all-groups] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
