import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { createHash } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { corsHeaders } from '../_shared/cors.ts'

// Función para hashear datos con SHA256
function sha256(data: string): string {
  const hash = createHash("sha256");
  hash.update(data);
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

    // Hashear datos del usuario
    const userData = eventData.user_data || {};
    const hashedUserData = {
      ph: userData.ph ? [sha256(userData.ph)] : [],
      em: userData.em ? [sha256(userData.em.toLowerCase())] : [],
    };

    const payload = {
      data: [{
        event_name: eventData.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventData.event_id,
        user_data: hashedUserData,
        custom_data: eventData.custom_data,
        action_source: 'whatsapp',
        ...(eventData.event_name === 'Purchase' && {
          currency: eventData.currency || 'USD',
          value: eventData.value || 0,
        }),
      }],
      ...(test_event_code && { test_event_code }),
    };

    const url = `https://graph.facebook.com/v20.0/${pixel_id}/events?access_token=${access_token}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error?.message || 'Error desconocido de la API de Meta.');
    }

    // Guardar en la bitácora
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseClient.from('meta_capi_events').insert({
      lead_id: eventData.lead_id,
      whatsapp_id: userData.ph,
      event_name: eventData.event_name,
      value: eventData.value,
      currency: eventData.currency,
      status: 'OK',
      emq_score: responseData.events_received, // Placeholder, EMQ se ve en el panel de Meta
      payload_sent: payload,
      meta_response: responseData,
      event_id: eventData.event_id,
    });

    return new Response(JSON.stringify({ success: true, response: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[meta-capi-sender] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})