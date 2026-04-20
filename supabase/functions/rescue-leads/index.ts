import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

// Leads que necesitan rescate (auditoría 20 abril 2026)
// Solo leads donde el cliente escribió y NO recibió respuesta IA
const RESCUE_LEADS = [
  {
    id: "64afa610-fa57-4f00-893f-f57f3ec3d642",  // Liliana Ledesma Torres
    nombre: "Liliana",
    msg: "Liliana Ledesma Torres\nY vivo en Aguascalientes",
  },
  {
    id: "f114e471-7f21-47d9-83d4-53f7af5c2c6f",  // Salvador
    nombre: "Salvador",
    msg: "Salvador y estoy en León",
  },
];

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const results: Array<{ nombre: string; status: string; detail?: string }> = [];

  for (const lead of RESCUE_LEADS) {
    try {
      // Verify lead exists and still needs response
      const { data: lastMsg } = await supabase
        .from('conversaciones')
        .select('emisor, created_at')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastMsg || lastMsg.emisor !== 'CLIENTE') {
        results.push({ nombre: lead.nombre, status: 'SKIP', detail: 'Ya tiene respuesta IA' });
        continue;
      }

      // Call process-samurai-response (it handles everything: AI, send, save)
      const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-samurai-response`;
      const fnRes = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, client_message: lead.msg })
      });

      const resData = await fnRes.json().catch(() => ({}));

      if (resData.aiText) {
        results.push({ nombre: lead.nombre, status: 'OK', detail: resData.aiText.substring(0, 100) });
        await supabase.from('activity_logs').insert({
          action: 'INFO', resource: 'BRAIN',
          description: `🚑 Lead rescatado: ${lead.nombre} — respuesta enviada correctamente`,
          status: 'OK'
        });
      } else {
        results.push({ nombre: lead.nombre, status: 'ERROR', detail: JSON.stringify(resData).substring(0, 100) });
      }

      // Wait 8 seconds between sends to avoid OpenAI rate limits
      await new Promise(r => setTimeout(r, 8000));

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      results.push({ nombre: lead.nombre, status: 'ERROR', detail: errMsg });
    }
  }

  return new Response(JSON.stringify({ results, timestamp: new Date().toISOString() }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
