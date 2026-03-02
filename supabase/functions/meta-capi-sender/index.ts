// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { createHash } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { corsHeaders } from '../_shared/cors.ts'

// NORMALIZACIÓN ESTRICTA (Meta Standard)
function normalizeAndHash(value: string | undefined | null): string | null {
  if (!value) return null;
  let clean = value.toLowerCase().trim();
  clean = clean.replace(/\+/g, '').replace(/\s/g, ''); 
  
  const hash = createHash("sha256");
  hash.update(clean);
  return hash.toString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { eventData, config } = await req.json();
    const { pixel_id, access_token, test_event_code } = config;

    if (!pixel_id || !access_token) {
      throw new Error("Pixel ID y Access Token son requeridos.");
    }

    const userData: any = {};
    if (eventData.user_data?.em) userData.em = [normalizeAndHash(eventData.user_data.em)];
    if (eventData.user_data?.ph) userData.ph = [normalizeAndHash(eventData.user_data.ph)];
    if (eventData.user_data?.fn) userData.fn = [normalizeAndHash(eventData.user_data.fn)];
    if (eventData.user_data?.ct) userData.ct = [normalizeAndHash(eventData.user_data.ct)];
    
    userData.country = [normalizeAndHash('mx')]; 

    const payload = {
      data: [{
        event_name: eventData.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventData.event_id || `samurai_${eventData.lead_id}_${Date.now()}`,
        user_data: userData,
        custom_data: {
           ...eventData.custom_data,
           currency: eventData.currency || 'MXN',
           value: eventData.value || 0,
           source: 'samurai_panel_v1'
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

    // Guardar en bitácora de eventos Meta
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    await supabaseClient.from('meta_capi_events').insert({
      lead_id: eventData.lead_id,
      whatsapp_id: eventData.user_data?.ph,
      event_name: eventData.event_name,
      value: eventData.value || 0,
      status: response.ok ? 'OK' : 'ERROR',
      payload_sent: payload,
      meta_response: responseData,
      event_id: payload.data[0].event_id
    });

    return new Response(JSON.stringify({ success: true, response: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})