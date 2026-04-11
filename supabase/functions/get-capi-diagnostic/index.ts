// @ts-nocheck
// get-capi-diagnostic — devuelve diagnóstico completo de Meta CAPI para un lead.
// Úsalo desde el dialog del EmqHeader en ChatView para ver qué datos tenemos
// recolectados, qué eventos se enviaron, y qué queda pendiente.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json();
    const leadId = body.lead_id;
    if (!leadId) {
      return new Response(JSON.stringify({ error: 'lead_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Lead completo
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: 'Lead not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Identity matching: 9 campos estándar Meta CAPI
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

    // 3. Campaign attribution (CTWA fields)
    const campaignFields = [
      { key: 'ctwa_clid', label: 'Click ID CTWA', value: lead.ctwa_clid, critical: true },
      { key: 'fbc', label: 'Facebook Click Cookie', value: lead.fbc, critical: true },
      { key: 'fbp', label: 'Facebook Pixel Cookie', value: lead.fbp, critical: false },
      { key: 'ad_source_id', label: 'Ad ID', value: lead.ad_source_id, critical: false },
      { key: 'ad_source_url', label: 'Ad URL', value: lead.ad_source_url, critical: false },
      { key: 'ad_source_type', label: 'Tipo', value: lead.ad_source_type, critical: false },
      { key: 'ad_headline', label: 'Titular del anuncio', value: lead.ad_headline, critical: false },
      { key: 'ad_body', label: 'Cuerpo del anuncio', value: lead.ad_body, critical: false },
    ];
    const hasAnyAttribution = campaignFields.some(f => f.value && String(f.value).trim() !== '');

    // 4. Events sent: últimos 20 eventos CAPI enviados (activity_logs con action=CAPI o CAPI_*)
    const { data: capiEvents } = await supabase
      .from('activity_logs')
      .select('id, action, description, status, created_at')
      .or(`action.eq.CAPI,action.eq.CAPI_PURCHASE,action.eq.CAPI_LEAD_LOST`)
      .ilike('description', `%${leadId}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    const eventsSent = (capiEvents || []).filter(e => e.status === 'OK');
    const eventsPending = (capiEvents || []).filter(e => e.status === 'PENDING');
    const eventsError = (capiEvents || []).filter(e => e.status === 'ERROR');

    // 5. Receipt audits del lead
    const { data: receipts } = await supabase
      .from('receipt_audits')
      .select('id, ai_verdict, amount_detected, matched_account, bank_detected, human_verified, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5);

    // 6. Last analysis: buscar el último log de analyze-leads/CAPI para este lead
    const { data: lastAnalysis } = await supabase
      .from('activity_logs')
      .select('created_at, description, action')
      .or('action.eq.CAPI,action.eq.UPDATE')
      .ilike('description', `%${lead.nombre || leadId}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    // 7. Config CAPI del canal
    let capiEnabledOnChannel = true;
    if (lead.channel_id) {
      const { data: ch } = await supabase
        .from('whatsapp_channels')
        .select('name, capi_enabled, ai_mode')
        .eq('id', lead.channel_id)
        .maybeSingle();
      if (ch) {
        capiEnabledOnChannel = ch.capi_enabled !== false;
      }
    }

    // Config global Meta
    const { data: configs } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', ['meta_pixel_id', 'meta_access_token', 'meta_test_event_code']);

    const configMap = (configs || []).reduce((acc: any, c: any) => ({ ...acc, [c.key]: c.value }), {});
    const hasPixelId = !!configMap.meta_pixel_id;
    const hasAccessToken = !!configMap.meta_access_token;
    const testEventCode = configMap.meta_test_event_code || null;

    // Compose response
    const diagnostic = {
      lead: {
        id: lead.id,
        nombre: lead.nombre,
        telefono: lead.telefono,
        buying_intent: lead.buying_intent,
        lead_score: lead.lead_score,
        payment_status: lead.payment_status,
        capi_lead_event_sent_at: lead.capi_lead_event_sent_at,
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
        referral_captured_at: lead.referral_captured_at,
      },
      events: {
        sent: eventsSent.map(e => ({ id: e.id, action: e.action, description: e.description, created_at: e.created_at })),
        pending: eventsPending.map(e => ({ id: e.id, action: e.action, description: e.description, created_at: e.created_at })),
        errors: eventsError.map(e => ({ id: e.id, action: e.action, description: e.description, created_at: e.created_at })),
        sent_count: eventsSent.length,
        pending_count: eventsPending.length,
        error_count: eventsError.length,
      },
      receipts: (receipts || []).map(r => ({
        id: r.id,
        verdict: r.ai_verdict,
        amount: r.amount_detected,
        matched_account: r.matched_account,
        bank: r.bank_detected,
        verified: r.human_verified,
        created_at: r.created_at,
      })),
      config: {
        capi_enabled_on_channel: capiEnabledOnChannel,
        has_pixel_id: hasPixelId,
        has_access_token: hasAccessToken,
        test_event_code: testEventCode,
        ready_to_send: hasPixelId && hasAccessToken && capiEnabledOnChannel,
      },
      last_analysis: lastAnalysis?.[0] || null,
    };

    return new Response(JSON.stringify(diagnostic), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[get-capi-diagnostic] crash:', err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
