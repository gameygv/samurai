// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

// NORMALIZACIÓN ESTRICTA (Meta Standard)
async function normalizeAndHash(value: string | undefined | null): Promise<string | null> {
  if (!value || value === 'null') return null;
  let clean = String(value).toLowerCase().trim();
  clean = clean.replace(/\+/g, '').replace(/\s/g, ''); 
  
  const encoder = new TextEncoder();
  const data = encoder.encode(clean);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { eventData, config } = await req.json();
    const pixel_id = Deno.env.get('META_PIXEL_ID') || config?.pixel_id;
    const access_token = Deno.env.get('META_ACCESS_TOKEN') || config?.access_token;
    const test_event_code = config?.test_event_code;

    if (!pixel_id || !access_token) {
      throw new Error("Pixel ID y Access Token son requeridos en Configuración.");
    }

    const userData: any = {};
    if (eventData.user_data?.em) userData.em = [await normalizeAndHash(eventData.user_data.em)];
    if (eventData.user_data?.ph) userData.ph = [await normalizeAndHash(eventData.user_data.ph)];
    if (eventData.user_data?.fn) userData.fn = [await normalizeAndHash(eventData.user_data.fn)];
    if (eventData.user_data?.ln) userData.ln = [await normalizeAndHash(eventData.user_data.ln)];
    if (eventData.user_data?.ct) userData.ct = [await normalizeAndHash(eventData.user_data.ct)];
    if (eventData.user_data?.st) userData.st = [await normalizeAndHash(eventData.user_data.st)];
    if (eventData.user_data?.zp) userData.zp = [await normalizeAndHash(eventData.user_data.zp)];
    userData.country = [await normalizeAndHash(eventData.user_data?.country || 'mx')]; 
    if (eventData.user_data?.external_id) userData.external_id = [await normalizeAndHash(eventData.user_data.external_id)];

    const payload = {
      data: [{
        event_name: eventData.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventData.event_id || `samurai_ev_${Date.now()}`,
        user_data: userData,
        custom_data: {
           ...eventData.custom_data,
           currency: eventData.currency || 'MXN',
           value: eventData.value || 0,
           source: 'samurai_kernel'
        },
        action_source: 'chat',
      }],
      ...(test_event_code && { test_event_code }),
    };

    const url = `https://graph.facebook.com/v19.0/${pixel_id}/events?access_token=${access_token}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    // Guardar en bitácora incluyendo los datos crudos
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    await supabaseClient.from('meta_capi_events').insert({
      lead_id: eventData.lead_id || null,
      whatsapp_id: eventData.user_data?.ph,
      event_name: eventData.event_name,
      value: eventData.value || 0,
      status: response.ok ? 'OK' : 'ERROR',
      payload_sent: payload,
      meta_response: responseData,
      unhashed_data: eventData, // DATOS SIN ENCRIPTAR PARA AUDITORÍA
      event_id: payload.data[0].event_id
    });

    return new Response(JSON.stringify({ success: true, response: responseData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})