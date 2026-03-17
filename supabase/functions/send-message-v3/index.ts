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

    if (chError || !channel) throw new Error("Canal no encontrado");

    const provider = channel.provider || 'gowa';
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Fix para números de México en Gowa
    if (cleanPhone.startsWith('52') && cleanPhone.length === 10) cleanPhone = '521' + cleanPhone;

    let endpoint = channel.api_url;
    let payload = {};
    let headers = { 'Content-Type': 'application/json' };

    if (provider === 'gowa') {
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      const baseUrl = channel.api_url.endsWith('/') ? channel.api_url.slice(0, -1) : channel.api_url;
      
      if (mediaData?.url) {
        endpoint = `${baseUrl}/send-media`;
        payload = { phone: cleanPhone, media_url: mediaData.url, caption: message || "", type: mediaData.type, instance_id: channel.instance_id };
      } else {
        endpoint = `${baseUrl}/send-message`;
        payload = { phone: cleanPhone, message: message, instance_id: channel.instance_id };
      }
    } 
    else if (provider === 'meta') {
      endpoint = `https://graph.facebook.com/v19.0/${channel.instance_id}/messages`;
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      payload = { messaging_product: "whatsapp", to: cleanPhone, type: "text", text: { body: message } };
    } 
    else {
      headers['apikey'] = channel.api_key;
      endpoint = `${channel.api_url}/message/sendText/${channel.instance_id}`;
      payload = { number: cleanPhone, text: message };
    }

    console.log(`[send-message] To: ${cleanPhone} via ${provider}`);

    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
    const resData = await response.json().catch(() => ({}));

    if (!response.ok) {
       return new Response(JSON.stringify({ success: false, error: resData, status: response.status }), { 
         status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
    }

    return new Response(JSON.stringify({ success: true, data: resData }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})