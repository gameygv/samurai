// backfill-geo-enrichment — Llena estado/cp faltantes en leads existentes
// Estrategia en 3 niveles:
//   1. Leads con ciudad conocida en mapa determinístico → lookup instantáneo
//   2. Leads con ciudad NO en mapa → IA infiere estado + cp
//   3. Leads sin ciudad pero con conversaciones → IA extrae ciudad de chat
// Dispara CAPI de enriquecimiento para leads que ya tenían un evento Lead.
// Invocar: supabase functions invoke backfill-geo-enrichment --no-verify-jwt
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { lookupGeo, inferGender } from '../_shared/mexico-geo.ts'

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    // Config
    const { data: configs } = await supabase.from('app_config').select('key, value');
    const configMap: Record<string, string> = (configs || []).reduce((acc: Record<string, string>, c: { key: string; value: string }) => ({ ...acc, [c.key]: c.value }), {});
    const metaPixelId = Deno.env.get('META_PIXEL_ID') || configMap.meta_pixel_id;
    const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN') || configMap.meta_access_token;
    const apiKey = Deno.env.get('OPENAI_API_KEY') || configMap.openai_api_key;

    let updated = 0;
    let capiSent = 0;
    let aiInferred = 0;

    // ── NIVEL 1 + 2: Leads con ciudad pero sin estado o cp ──
    const { data: leadsWithCity } = await supabase
      .from('leads')
      .select('id, nombre, telefono, email, ciudad, estado, cp, buying_intent, channel_id, fbc, fbp, ctwa_clid, capi_lead_event_sent_at, servicio_interes, assigned_to, genero')
      .not('ciudad', 'is', null)
      .neq('ciudad', '')
      .or('estado.is.null,estado.eq.,cp.is.null,cp.eq.')
      .order('last_message_at', { ascending: false })
      .limit(200);

    for (const lead of (leadsWithCity || [])) {
      // deno-lint-ignore no-explicit-any
      const updates: Record<string, any> = {};

      // Nivel 1: mapa determinístico
      const geo = lookupGeo(lead.ciudad);
      if (geo) {
        if (!lead.cp) updates.cp = geo.cp;
        if (!lead.estado) updates.estado = geo.estado;
      } else if (apiKey) {
        // Nivel 2: IA infiere estado y cp de la ciudad
        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: 'user', content:
                `Para la ciudad "${lead.ciudad}" en México, responde SOLO con JSON: {"estado": "nombre del estado", "cp": "código postal 5 dígitos del centro"}. Si no es una ciudad mexicana real, responde {"estado": null, "cp": null}.`
              }],
              temperature: 0, max_tokens: 60,
              response_format: { type: "json_object" }
            })
          });
          if (res.ok) {
            const aiData = await res.json();
            const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');
            if (parsed.estado && !lead.estado) updates.estado = parsed.estado;
            if (parsed.cp && /^\d{5}$/.test(String(parsed.cp)) && !lead.cp) updates.cp = String(parsed.cp);
            if (updates.estado || updates.cp) aiInferred++;
          }
        } catch (_) { /* silenciar error AI */ }
      }

      if (Object.keys(updates).length === 0) continue;

      await supabase.from('leads').update(updates).eq('id', lead.id);
      updated++;

      // CAPI enriquecimiento
      await sendCapiEnrich(supabase, lead, updates, metaPixelId, metaAccessToken, configMap);
      capiSent++;
    }

    // ── NIVEL 3: Leads SIN ciudad — extraer de conversaciones con IA ──
    if (apiKey) {
      const { data: leadsNoCity } = await supabase
        .from('leads')
        .select('id, nombre, telefono, email, ciudad, estado, cp, buying_intent, channel_id, fbc, fbp, ctwa_clid, capi_lead_event_sent_at, servicio_interes, assigned_to, genero')
        .or('ciudad.is.null,ciudad.eq.')
        .or('estado.is.null,estado.eq.')
        .order('last_message_at', { ascending: false })
        .limit(100);

      for (const lead of (leadsNoCity || [])) {
        // Obtener últimos mensajes del lead
        const { data: msgs } = await supabase.from('conversaciones')
          .select('mensaje, emisor')
          .eq('lead_id', lead.id)
          .neq('platform', 'PANEL_INTERNO')
          .order('created_at', { ascending: false })
          .limit(8);

        if (!msgs || msgs.length === 0) continue;

        const chatContext = msgs.reverse().map(m => {
          const role = m.emisor === 'CLIENTE' ? 'CLIENTE' : 'ASESOR';
          return `${role}: ${m.mensaje}`;
        }).join('\n');

        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: 'user', content:
                `Lee esta conversación y extrae la ciudad y estado del cliente en México. Si el cliente menciona de dónde es, extrae esa info. Si no la menciona, responde null.\n\nCONVERSACION:\n${chatContext}\n\nResponde SOLO con JSON: {"ciudad": "nombre" o null, "estado": "nombre del estado mexicano" o null, "cp": "5 dígitos del centro de esa ciudad" o null}`
              }],
              temperature: 0, max_tokens: 80,
              response_format: { type: "json_object" }
            })
          });
          if (!res.ok) continue;
          const aiData = await res.json();
          const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');

          // deno-lint-ignore no-explicit-any
          const updates: Record<string, any> = {};
          if (parsed.ciudad && parsed.ciudad.length > 2 && !lead.ciudad) updates.ciudad = parsed.ciudad;
          if (parsed.estado && parsed.estado.length > 2 && !lead.estado) updates.estado = parsed.estado;
          if (parsed.cp && /^\d{5}$/.test(String(parsed.cp)) && !lead.cp) updates.cp = String(parsed.cp);

          // Si la IA dio ciudad, intentar geo lookup para validar/completar
          if (updates.ciudad) {
            const geo = lookupGeo(updates.ciudad);
            if (geo) {
              if (!updates.cp && !lead.cp) updates.cp = geo.cp;
              if (!updates.estado && !lead.estado) updates.estado = geo.estado;
            }
          }

          if (Object.keys(updates).length === 0) continue;

          await supabase.from('leads').update(updates).eq('id', lead.id);
          updated++;
          aiInferred++;

          await sendCapiEnrich(supabase, lead, updates, metaPixelId, metaAccessToken, configMap);
          capiSent++;
        } catch (_) { /* silenciar */ }
      }
    }

    // Log resumen
    await supabase.from('activity_logs').insert({
      action: 'INFO', resource: 'SYSTEM',
      description: `🗺️ Backfill geo: ${updated} leads actualizados (${aiInferred} por IA), ${capiSent} eventos CAPI enriquecimiento`,
      status: 'OK'
    });

    return new Response(JSON.stringify({
      message: 'Backfill complete',
      updated,
      ai_inferred: aiInferred,
      capi_sent: capiSent
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[backfill-geo-enrichment] error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Helper: envía evento CAPI de enriquecimiento si el lead ya tenía un evento Lead
// deno-lint-ignore no-explicit-any
async function sendCapiEnrich(supabase: any, lead: any, updates: any, pixelId: string, accessToken: string, configMap: Record<string, string>) {
  if (!lead.capi_lead_event_sent_at || !pixelId || !accessToken) return;

  // Verificar CAPI del canal
  if (lead.channel_id) {
    const { data: ch } = await supabase.from('whatsapp_channels')
      .select('capi_enabled').eq('id', lead.channel_id).maybeSingle();
    if (ch?.capi_enabled === false) return;
  }

  const enrichTimestamp = Math.floor(Date.now() / 1000);
  const eventMap: Record<string, string> = { 'BAJO': 'Lead', 'MEDIO': 'ViewContent', 'ALTO': 'InitiateCheckout', 'COMPRADO': 'Purchase' };
  const eventName = eventMap[lead.buying_intent] || 'Lead';
  const gender = lead.genero || inferGender(lead.nombre);

  try {
    await supabase.functions.invoke('meta-capi-sender', {
      body: {
        config: {
          pixel_id: pixelId,
          access_token: accessToken,
          test_event_code: configMap.meta_test_event_code || undefined
        },
        eventData: {
          event_name: eventName,
          event_id: `samurai_${lead.id}_backfill_${enrichTimestamp}`,
          lead_id: lead.id,
          user_data: {
            ph: lead.telefono,
            fn: lead.nombre?.split(' ')[0],
            ln: lead.nombre?.split(' ').slice(1).join(' ') || undefined,
            em: lead.email || undefined,
            ct: updates.ciudad || lead.ciudad || undefined,
            st: updates.estado || lead.estado || undefined,
            zp: updates.cp || lead.cp || undefined,
            ge: gender || undefined,
            country: 'mx',
            external_id: lead.id,
            fbc: lead.fbc || undefined,
            fbp: lead.fbp || undefined,
            ctwa_clid: lead.ctwa_clid || undefined
          },
          custom_data: {
            source: 'samurai_backfill',
            content_name: lead.servicio_interes || undefined,
            content_category: 'talleres_cuencoterapia',
            funnel_stage: lead.buying_intent,
            origin_channel: 'whatsapp',
            currency: eventName === 'Purchase' ? 'MXN' : undefined,
            value: eventName === 'Purchase' ? 0 : undefined
          }
        }
      }
    });
  } catch (err) {
    console.error(`CAPI backfill error for ${lead.id}:`, err);
  }
}
