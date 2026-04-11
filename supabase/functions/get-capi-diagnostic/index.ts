// @ts-nocheck
// get-capi-diagnostic — devuelve diagnóstico completo de Meta CAPI para un lead.
// Defensivo: cada sección está aislada en try/catch, si una falla el resto aún se devuelve.
// Siempre responde 200 con JSON estructurado (frontend maneja campos ausentes).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const errors: string[] = [];

  try {
    let body: any = {};
    try { body = await req.json(); } catch (_) { /* body vacío */ }
    const leadId = body?.lead_id;

    if (!leadId) {
      return new Response(JSON.stringify({ error: 'lead_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Lead completo — si falla esto sí devolvemos 404
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .maybeSingle();

    if (leadErr) {
      console.error('[diagnostic] lead query error:', leadErr);
      return new Response(JSON.stringify({ error: `lead query failed: ${leadErr.message}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (!lead) {
      return new Response(JSON.stringify({ error: 'Lead not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Identity matching (siempre funciona, es calculo local)
    const identityFields = [
      { key: 'ph', label: 'Teléfono', value: lead.telefono, required: true },
      { key: 'em', label: 'Email', value: lead.email, required: true },
      { key: 'fn', label: 'Nombre', value: lead.nombre?.split(' ')[0], required: true },
      { key: 'ln', label: 'Apellido', value: lead.nombre?.split(' ').slice(1).join(' ') || null, required: false },
      { key: 'ct', label: 'Ciudad', value: lead.ciudad, required: false },
      { key: 'st', label: 'Estado', value: lead.estado, required: false },
      { key: 'zp', label: 'Código postal', value: lead.cp, required: false },
      { key: 'country', label: 'País', value: 'mx', required: false },
      { key: 'external_id', label: 'External ID', value: lead.id, required: true },
    ];
    const identityPresent = identityFields.filter(f => f.value && String(f.value).trim() !== '').length;
    const identityScore = Math.round((identityPresent / identityFields.length) * 100);

    // 3. Campaign attribution (las columnas pueden ser null en leads viejos, no es error)
    const campaignFields = [
      { key: 'ctwa_clid', label: 'Click ID CTWA', value: lead.ctwa_clid ?? null, critical: true },
      { key: 'fbc', label: 'Facebook Click Cookie', value: lead.fbc ?? null, critical: true },
      { key: 'fbp', label: 'Facebook Pixel Cookie', value: lead.fbp ?? null, critical: false },
      { key: 'ad_source_id', label: 'Ad ID', value: lead.ad_source_id ?? null, critical: false },
      { key: 'ad_source_url', label: 'Ad URL', value: lead.ad_source_url ?? null, critical: false },
      { key: 'ad_source_type', label: 'Tipo', value: lead.ad_source_type ?? null, critical: false },
      { key: 'ad_headline', label: 'Titular del anuncio', value: lead.ad_headline ?? null, critical: false },
      { key: 'ad_body', label: 'Cuerpo del anuncio', value: lead.ad_body ?? null, critical: false },
    ];
    const hasAnyAttribution = campaignFields.some(f => f.value && String(f.value).trim() !== '');

    // 4. Events sent — DEFENSIVO: la query .or() + .ilike puede fallar por varios motivos
    let eventsSent: any[] = [];
    let eventsPending: any[] = [];
    let eventsError: any[] = [];
    try {
      // Nota: ilike con un UUID es seguro (no tiene caracteres especiales de pattern)
      const { data: capiEvents, error: capiErr } = await supabase
        .from('activity_logs')
        .select('id, action, description, status, created_at')
        .in('action', ['CAPI', 'CAPI_PURCHASE', 'CAPI_LEAD_LOST'])
        .ilike('description', `%${leadId}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (capiErr) {
        errors.push(`capi_events: ${capiErr.message}`);
      } else if (capiEvents) {
        eventsSent = capiEvents.filter(e => e.status === 'OK');
        eventsPending = capiEvents.filter(e => e.status === 'PENDING');
        eventsError = capiEvents.filter(e => e.status === 'ERROR');
      }
    } catch (e: any) {
      errors.push(`capi_events crash: ${e?.message || e}`);
    }

    // 5. Receipt audits del lead
    let receipts: any[] = [];
    try {
      const { data: r, error: rErr } = await supabase
        .from('receipt_audits')
        .select('id, ai_verdict, amount_detected, matched_account, bank_detected, human_verified, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(5);
      if (rErr) errors.push(`receipts: ${rErr.message}`);
      else if (r) receipts = r;
    } catch (e: any) {
      errors.push(`receipts crash: ${e?.message || e}`);
    }

    // 6. Last analysis — query simple por lead_id embebido en description
    let lastAnalysis: any = null;
    try {
      const { data: la, error: laErr } = await supabase
        .from('activity_logs')
        .select('created_at, description, action')
        .ilike('description', `%${leadId}%`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (laErr) errors.push(`last_analysis: ${laErr.message}`);
      else if (la && la.length > 0) lastAnalysis = la[0];
    } catch (e: any) {
      errors.push(`last_analysis crash: ${e?.message || e}`);
    }

    // 7. Config CAPI del canal
    let capiEnabledOnChannel = true;
    let channelName: string | null = null;
    try {
      if (lead.channel_id) {
        const { data: ch, error: chErr } = await supabase
          .from('whatsapp_channels')
          .select('name, capi_enabled, ai_mode')
          .eq('id', lead.channel_id)
          .maybeSingle();
        if (chErr) errors.push(`channel: ${chErr.message}`);
        else if (ch) {
          capiEnabledOnChannel = ch.capi_enabled !== false;
          channelName = ch.name;
        }
      }
    } catch (e: any) {
      errors.push(`channel crash: ${e?.message || e}`);
    }

    // 8. Config global Meta
    let hasPixelId = false;
    let hasAccessToken = false;
    let testEventCode: string | null = null;
    try {
      const { data: configs } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', ['meta_pixel_id', 'meta_access_token', 'meta_test_event_code']);
      const configMap = (configs || []).reduce((acc: any, c: any) => ({ ...acc, [c.key]: c.value }), {});
      hasPixelId = !!(Deno.env.get('META_PIXEL_ID') || configMap.meta_pixel_id);
      hasAccessToken = !!(Deno.env.get('META_ACCESS_TOKEN') || configMap.meta_access_token);
      testEventCode = configMap.meta_test_event_code || null;
    } catch (e: any) {
      errors.push(`config crash: ${e?.message || e}`);
    }

    const diagnostic = {
      lead: {
        id: lead.id,
        nombre: lead.nombre || '',
        telefono: lead.telefono || '',
        buying_intent: lead.buying_intent || 'BAJO',
        lead_score: lead.lead_score ?? 0,
        payment_status: lead.payment_status || null,
        capi_lead_event_sent_at: lead.capi_lead_event_sent_at || null,
      },
      identity: {
        score_percent: identityScore,
        fields_present: identityPresent,
        fields_total: identityFields.length,
        fields: identityFields.map(f => ({
          key: f.key,
          label: f.label,
          present: !!(f.value && String(f.value).trim() !== ''),
          required: f.required,
          value: f.value ? String(f.value).substring(0, 40) : null,
        })),
      },
      campaign: {
        has_attribution: hasAnyAttribution,
        fields: campaignFields.map(f => ({
          key: f.key,
          label: f.label,
          present: !!(f.value && String(f.value).trim() !== ''),
          critical: f.critical,
          value: f.value ? String(f.value).substring(0, 80) : null,
        })),
        referral_captured_at: lead.referral_captured_at || null,
      },
      events: {
        sent: eventsSent.map(e => ({ id: e.id, action: e.action, description: e.description, created_at: e.created_at })),
        pending: eventsPending.map(e => ({ id: e.id, action: e.action, description: e.description, created_at: e.created_at })),
        errors: eventsError.map(e => ({ id: e.id, action: e.action, description: e.description, created_at: e.created_at })),
        sent_count: eventsSent.length,
        pending_count: eventsPending.length,
        error_count: eventsError.length,
      },
      receipts: receipts.map(r => ({
        id: r.id,
        verdict: r.ai_verdict,
        amount: Number(r.amount_detected) || 0,
        matched_account: r.matched_account,
        bank: r.bank_detected,
        verified: r.human_verified,
        created_at: r.created_at,
      })),
      config: {
        channel_name: channelName,
        capi_enabled_on_channel: capiEnabledOnChannel,
        has_pixel_id: hasPixelId,
        has_access_token: hasAccessToken,
        test_event_code: testEventCode,
        ready_to_send: hasPixelId && hasAccessToken && capiEnabledOnChannel,
      },
      last_analysis: lastAnalysis,
      // Exposición de errores parciales para que el frontend pueda avisarlos
      diagnostic_errors: errors,
    };

    return new Response(JSON.stringify(diagnostic), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('[get-capi-diagnostic] fatal crash:', err);
    return new Response(JSON.stringify({
      error: 'fatal',
      message: String(err?.message || err),
      stack: String(err?.stack || '').substring(0, 500),
      errors_so_far: errors,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
