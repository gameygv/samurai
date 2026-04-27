import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { invokeFunction } from '../_shared/invoke.ts'

// Procesa eventos CAPI_PURCHASE y CAPI_LEAD_LOST pendientes en activity_logs
// Disparado por: Pipeline drag & drop o cualquier UI que cambie buying_intent
serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    // Buscar eventos pendientes (Purchase + LeadLost)
    const { data: pending } = await supabase.from('activity_logs')
      .select('id, action, description')
      .in('action', ['CAPI_PURCHASE', 'CAPI_LEAD_LOST'])
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true })
      .limit(10);

    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let processed = 0;
    for (const event of pending) {
      try {
        // deno-lint-ignore no-explicit-any
        const data: any = JSON.parse(event.description);
        const eventTimestamp = Math.floor(Date.now() / 1000);

        // Determinar evento Meta según el tipo de acción
        const isPurchase = event.action === 'CAPI_PURCHASE';
        const capiEventName = isPurchase ? 'Purchase' : 'LeadLost';
        const funnelStage = isPurchase ? 'COMPRADO' : 'PERDIDO';

        // Fetch lead completo para obtener campos de atribución (fbc, fbp, ctwa_clid)
        // que el trigger SQL no incluye en el JSON del activity_log
        let leadFbc: string | undefined;
        let leadFbp: string | undefined;
        let leadCtwaClid: string | undefined;
        if (data.lead_id) {
          const { data: leadFull } = await supabase.from('leads')
            .select('fbc, fbp, ctwa_clid, is_test_lead')
            .eq('id', data.lead_id).maybeSingle();
          if (leadFull) {
            // Skip test leads — never send to Meta CAPI
            if (leadFull.is_test_lead) {
              console.log(`[process-capi-purchase] Skipping test lead ${data.lead_id}`);
              await supabase.from('activity_logs').update({ status: 'OK', description: event.description + ' [SKIPPED: test lead]' }).eq('id', event.id);
              processed++;
              continue;
            }
            leadFbc = leadFull.fbc || undefined;
            leadFbp = leadFull.fbp || undefined;
            leadCtwaClid = leadFull.ctwa_clid || undefined;
          }
        }

        await invokeFunction({
          functionName: 'meta-capi-sender',
          body: {
            config: {
              pixel_id: data.pixel_id,
              access_token: data.access_token,
              test_event_code: data.test_event_code || undefined
            },
            eventData: {
              event_name: capiEventName,
              event_id: `samurai_${data.lead_id}_${capiEventName}_${eventTimestamp}`,
              lead_id: data.lead_id,
              user_data: {
                ph: data.telefono,
                fn: data.nombre?.split(' ')[0],
                ln: data.nombre?.split(' ').slice(1).join(' ') || undefined,
                em: data.email || undefined,
                ct: data.ciudad || undefined,
                st: data.estado || undefined,
                zp: data.cp || undefined,
                country: 'mx',
                external_id: data.lead_id,
                fbc: leadFbc,
                fbp: leadFbp,
                ctwa_clid: leadCtwaClid
              },
              custom_data: {
                source: 'samurai_auto',
                content_name: data.servicio_interes || 'taller_cuencoterapia',
                content_category: 'talleres_cuencoterapia',
                currency: isPurchase ? 'MXN' : undefined,
                value: isPurchase ? 0 : undefined,
                funnel_stage: funnelStage,
                previous_stage: data.previous_intent || undefined,
                origin_channel: 'whatsapp',
                agent_id: data.assigned_to || undefined
              }
            }
          },
          supabase,
          errorContext: `${event.action} lead=${data.lead_id}`,
        });

        await supabase.from('activity_logs').update({ status: 'OK' }).eq('id', event.id);
        processed++;
      } catch (err) {
        console.error(`${event.action} CAPI error:`, err);
        await supabase.from('activity_logs').update({ status: 'ERROR' }).eq('id', event.id);
      }
    }

    return new Response(JSON.stringify({ processed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('process-capi-purchase error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 200, headers: corsHeaders });
  }
});
