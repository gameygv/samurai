// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('PERDIDO_PROTECTION') ?? '');

  try {
    const { data: configs } = await supabase.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc: any, c) => ({ ...acc, [c.key]: c.value }), {}) || {};
    
    const daysToLost = parseInt(configMap.days_to_lost_lead || '14');
    
    // NUNCA marcar leads como PERDIDO si el setting es 0 o negativo
    if (daysToLost <= 0) {
      return new Response(JSON.stringify({ message: 'Auto-lost disabled (days_to_lost_lead <= 0)' }), { headers: corsHeaders });
    }

    // Buscar leads que NO estén en etapa cerrada
    const { data: activeLeads } = await supabase.from('leads')
      .select('id, nombre, buying_intent, last_message_at, created_at')
      .not('buying_intent', 'in', '("PERDIDO","COMPRADO")');

    if (!activeLeads || activeLeads.length === 0) {
      return new Response(JSON.stringify({ message: 'No active leads found' }), { headers: corsHeaders });
    }

    const now = new Date();
    const thresholdDate = new Date(now.getTime() - (daysToLost * 24 * 60 * 60 * 1000));
    
    let lostCount = 0;
    const results = [];

    for (const lead of activeLeads) {
      // PROTECCIÓN CRÍTICA: Lead debe existir por al menos 24 horas antes de poder ser marcado como PERDIDO
      const leadCreatedAt = new Date(lead.created_at);
      const leadAgeMs = now.getTime() - leadCreatedAt.getTime();
      const leadAgeHours = leadAgeMs / (1000 * 60 * 60);
      
      if (leadAgeHours < 24) {
        results.push({ id: lead.id, status: 'PROTECTED', reason: `Lead creado hace ${leadAgeHours.toFixed(1)} horas (menos de 24h)` });
        continue;
      }

      // Si no hay last_message_at, usar created_at como fallback
      const lastActivity = lead.last_message_at ? new Date(lead.last_message_at) : new Date(lead.created_at);
      
      if (lastActivity < thresholdDate) {
        const { error } = await supabase.from('leads').update({ buying_intent: 'PERDIDO' }).eq('id', lead.id);
        if (!error) {
          lostCount++;
          results.push({ id: lead.id, status: 'MARKED_LOST', reason: `Sin actividad por ${daysToLost}+ días` });
        }
      }
    }

    return new Response(JSON.stringify({ 
      message: `Processed ${activeLeads.length} leads. Marked ${lostCount} as lost. Protected new leads.`,
      results 
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});