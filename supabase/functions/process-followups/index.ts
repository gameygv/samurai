// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const { data: configs } = await supabase.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc: any, c) => ({ ...acc, [c.key]: c.value }), {}) || {};
    
    const daysToLost = parseInt(configMap.days_to_lost_lead || '14');
    
    if (daysToLost <= 0) {
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
      // BLINDAJE 4: Protección de 24 horas. El cron job JAMÁS matará un lead que acaba de entrar.
      const leadCreatedAt = new Date(lead.created_at);
      const leadAgeMs = now.getTime() - leadCreatedAt.getTime();
      const leadAgeHours = leadAgeMs / (1000 * 60 * 60);
      
      if (leadAgeHours < 24) {
        results.push({ id: lead.id, status: 'PROTECTED', reason: '< 24h old' });
        continue;
      }

      const lastActivity = lead.last_message_at ? new Date(lead.last_message_at) : new Date(lead.created_at);
      
      if (lastActivity < thresholdDate) {
        const { error } = await supabase.from('leads').update({ buying_intent: 'PERDIDO' }).eq('id', lead.id);
        if (!error) {
          lostCount++;
          results.push({ id: lead.id, status: 'MARKED_LOST' });
        }
      }
    }

    return new Response(JSON.stringify({ message: `Processed. Marked ${lostCount} lost.`, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
});