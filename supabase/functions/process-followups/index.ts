// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

const MIN_DAYS_TO_LOST = 3;
const PROTECTION_HOURS = 72;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const { data: configs } = await supabase.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc: any, c) => ({ ...acc, [c.key]: c.value }), {}) || {};

    // BLINDAJE: Mínimo 3 días. Nunca permitir valores absurdos.
    const rawDays = parseInt(configMap.days_to_lost_lead || '14');
    const daysToLost = Math.max(rawDays, MIN_DAYS_TO_LOST);

    if (rawDays <= 0) {
      return new Response(JSON.stringify({ message: 'Auto-lost disabled' }), { headers: corsHeaders });
    }

    const { data: activeLeads } = await supabase.from('leads')
      .select('id, nombre, buying_intent, last_message_at, created_at')
      .not('buying_intent', 'in', '("PERDIDO","COMPRADO")');

    if (!activeLeads || activeLeads.length === 0) {
      return new Response(JSON.stringify({ message: 'No active leads' }), { headers: corsHeaders });
    }

    const now = new Date();
    const thresholdDate = new Date(now.getTime() - (daysToLost * 24 * 60 * 60 * 1000));

    let lostCount = 0;
    const results = [];

    for (const lead of activeLeads) {
      // BLINDAJE REFORZADO: Protección de 72 horas desde creación.
      // Ningún lead reciente será marcado como PERDIDO.
      const leadCreatedAt = new Date(lead.created_at);
      const leadAgeMs = now.getTime() - leadCreatedAt.getTime();
      const leadAgeHours = leadAgeMs / (1000 * 60 * 60);

      if (leadAgeHours < PROTECTION_HOURS) {
        results.push({ id: lead.id, nombre: lead.nombre, status: 'PROTECTED', reason: `< ${PROTECTION_HOURS}h old (${Math.round(leadAgeHours)}h)` });
        continue;
      }

      const lastActivity = lead.last_message_at ? new Date(lead.last_message_at) : new Date(lead.created_at);

      // Doble check: también proteger si tuvo actividad reciente (últimas 72h)
      const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
      if (hoursSinceActivity < PROTECTION_HOURS) {
        results.push({ id: lead.id, nombre: lead.nombre, status: 'ACTIVE', reason: `Activity ${Math.round(hoursSinceActivity)}h ago` });
        continue;
      }

      if (lastActivity < thresholdDate) {
        const { error } = await supabase.from('leads').update({ buying_intent: 'PERDIDO' }).eq('id', lead.id);
        if (!error) {
          lostCount++;
          results.push({ id: lead.id, nombre: lead.nombre, status: 'MARKED_LOST', daysSinceActivity: Math.round(hoursSinceActivity / 24) });
          // Log cada transición para auditoría
          await supabase.from('activity_logs').insert({
            action: 'UPDATE', resource: 'LEADS',
            description: `⚠️ Lead ${lead.nombre} marcado PERDIDO por inactividad (${Math.round(hoursSinceActivity / 24)} días sin actividad, umbral: ${daysToLost} días)`,
            status: 'OK'
          });
        }
      } else {
        results.push({ id: lead.id, nombre: lead.nombre, status: 'OK', daysSinceActivity: Math.round(hoursSinceActivity / 24) });
      }
    }

    return new Response(JSON.stringify({
      message: `Processed. Marked ${lostCount} lost.`,
      config: { daysToLost, rawDays, protectionHours: PROTECTION_HOURS },
      results
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
