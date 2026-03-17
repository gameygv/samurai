// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { channel_id, phone, message, mediaData } = await req.json();
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    const { data: channel, error: chError } = await supabaseClient
      .from('whatsapp_channels').select('*').eq('id', channel_id).single();

    if (chError || !channel) throw new Error("Canal no encontrado en la base de datos.");

    const provider = channel.provider || 'gowa';
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Normalización de números para Gowa (JID)
    const phoneJid = cleanPhone.includes('@') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;

    let endpoint = channel.api_url;
    if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);

    let payload = {};
    let headers = { 'Content-Type': 'application/json' };

    if (provider === 'gowa') {
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      
      if (mediaData?.url) {
        endpoint = `${endpoint}/send-media`;
        payload = { 
            phone: cleanPhone, // Algunos prefieren numero limpio
            device_id: channel.instance_id, // Gowa suele usar device_id
            instance_id: channel.instance_id, // Fallback
            media_url: mediaData.url, 
            caption: message || "", 
            type: mediaData.type 
        };
      } else {
        endpoint = `${endpoint}/send-message`;
        payload = { 
            phone: cleanPhone,
            device_id: channel.instance_id,
            instance_id: channel.instance_id,
            message: message 
        };
      }
    } 
    else if (provider === 'meta') {
      endpoint = `https://graph.facebook.com/v19.0/${channel.instance_id}/messages`;
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      payload = { messaging_product: "whatsapp", to: cleanPhone, type: "text", text: { body: message } };
    } 
    else {
      headers['apikey'] = channel.api_key;
      endpoint = `${endpoint}/message/sendText/${channel.instance_id}`;
      payload = { number: cleanPhone, text: message };
    }

    console.log(`[send-message] Enviando a: ${endpoint} | Payload:`, JSON.stringify(payload));

    const response = await fetch(endpoint, { 
        method: 'POST', 
        headers, 
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
    });

    const resText = await response.text();
    let resData = {};
    try { resData = JSON.parse(resText); } catch(e) { resData = { rawResponse: resText }; }

    if (!response.ok) {
       console.error("[send-message] Error del servidor:", resText);
       return new Response(JSON.stringify({ 
         success: false, 
         error: resData.message || resData.error || resText || "Error desconocido del servidor Gowa",
         status: response.status 
       }), { 
         status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
    }

    return new Response(JSON.stringify({ success: true, data: resData }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("[send-message] Error crítico:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})