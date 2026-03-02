// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { createHash } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { corsHeaders } from '../_shared/cors.ts'

// NORMALIZACIÓN ESTRICTA (Meta Standard)
function normalizeAndHash(value: string | undefined | null): string | null {
  if (!value) return null;
  
  // 1. Convertir a minúsculas y trim
  let clean = value.toLowerCase().trim();
  
  // 2. Normalizar teléfonos (solo dígitos, quitar 0 inicial si es necesario, etc)
  // Nota: Asumimos que el input ya trae código de país o es procesable.
  // Para emails y textos, esto no afecta mucho.
  clean = clean.replace(/\+/g, ''); // Quitar + del teléfono
  
  // 3. Hashing SHA256
  const hash = createHash("sha256");
  hash.update(clean);
  return hash.toString();
}

// Normalización específica para ciudad (quitar espacios, símbolos)
function normalizeCity(city: string): string {
  if (!city) return '';
  return city.toLowerCase().replace(/[^a-z]/g, '');
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

    // DATOS CRUDOS
    const rawEmail = eventData.user_data?.em;
    const rawPhone = eventData.user_data?.ph;
    const rawCity = eventData.user_data?.ct; // Ciudad ahora en user_data
    const rawName = eventData.user_data?.fn; // Nombre

    // HASHING AVANZADO
    const userData: any = {};
    
    if (rawEmail) userData.em = [normalizeAndHash(rawEmail)];
    if (rawPhone) userData.ph = [normalizeAndHash(rawPhone)];
    if (rawCity) userData.ct = [normalizeAndHash(normalizeCity(rawCity))];
    if (rawName) userData.fn = [normalizeAndHash(rawName)];
    
    // Default country (opcional, ayuda al match)
    userData.country = [normalizeAndHash('mx')]; 

    const payload = {
      data: [{
        event_name: eventData.event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventData.event_id || `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        user_data: userData,
        custom_data: {
           ...eventData.custom_data,
           source_platform: 'samurai_ai'
        },
        action_source: 'chat', // ESTÁNDAR CORRECTO PARA WHATSAPP
      }],
      ...(test_event_code && { test_event_code }),
    };

    console.log(`[Meta CAPI] Sending ${eventData.event_name} for ${rawEmail ? 'Email User' : 'Phone User'}`);

    const url = `https://graph.facebook.com/v20.0/${pixel_id}/events?access_token=${access_token}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.error?.message || 'Error desconocido de Meta.');
    }

    // LOGGING
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseClient.from('meta_capi_events').insert({
      lead_id: eventData.lead_id,
      whatsapp_id: rawPhone, // Guardamos el raw para referencia interna
      event_name: eventData.event_name,
      value: eventData.value || 0,
      currency: eventData.currency || 'MXN',
      status: 'OK',
      payload_sent: payload,
      meta_response: responseData,
      event_id: payload.data[0].event_id,
    });

    return new Response(JSON.stringify({ success: true, response: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[meta-capi-sender] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})