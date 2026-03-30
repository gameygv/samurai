// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-device-id',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { channel_id, phone, message, mediaData, lead_id } = await req.json();
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    let actualChannelId = channel_id;

    // 1. AUTO-RESOLVER CANAL
    if (!actualChannelId && lead_id) {
       const { data: leadData } = await supabaseClient.from('leads').select('channel_id').eq('id', lead_id).single();
       if (leadData?.channel_id) actualChannelId = leadData.channel_id;
    }

    if (!actualChannelId) {
       const { data: cfg } = await supabaseClient.from('app_config').select('value').eq('key', 'default_notification_channel').maybeSingle();
       if (cfg?.value) actualChannelId = cfg.value;
    }

    if (!actualChannelId) {
       const { data: first } = await supabaseClient.from('whatsapp_channels').select('id').eq('is_active', true).limit(1).maybeSingle();
       if (first?.id) actualChannelId = first.id;
    }

    const { data: channel, error: chError } = await supabaseClient
      .from('whatsapp_channels').select('*').eq('id', actualChannelId).single();

    if (chError || !channel) throw new Error("Canal no encontrado.");

    const provider = channel.provider || 'gowa';
    let cleanPhone = phone.replace(/\D/g, '');
    
    // CORRECCIÓN CRÍTICA MÉXICO PARA META CLOUD API
    // Meta prefiere 52 + 10 dígitos (sin el 1 de móvil)
    if (provider === 'meta' && cleanPhone.startsWith('521') && cleanPhone.length === 13) {
        cleanPhone = '52' + cleanPhone.substring(3);
    }

    let endpoint = channel.api_url;
    if (endpoint?.endsWith('/')) endpoint = endpoint.slice(0, -1);

    let headers = { 'Content-Type': 'application/json' };
    let bodyContent: any;

    if (provider === 'meta') {
      endpoint = `https://graph.facebook.com/v22.0/${channel.instance_id}/messages`;
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      
      if (mediaData?.url) {
         const typeMap = { image: 'image', video: 'video', audio: 'audio', document: 'document' };
         const metaType = typeMap[mediaData.type] || 'document';
         bodyContent = JSON.stringify({
            messaging_product: "whatsapp", to: cleanPhone, type: metaType,
            [metaType]: { link: mediaData.url, caption: message || '' }
         });
      } else {
         bodyContent = JSON.stringify({
            messaging_product: "whatsapp", to: cleanPhone, type: "text",
            text: { body: message }
         });
      }
    } 
    else if (provider === 'gowa') {
      headers['Authorization'] = channel.api_key.startsWith('Basic ') ? channel.api_key : `Basic ${channel.api_key}`;
      headers['X-Device-Id'] = channel.instance_id;
      
      if (mediaData?.url) {
        delete headers['Content-Type']; 
        const fileRes = await fetch(mediaData.url);
        const fileBlob = await fileRes.blob();
        const formData = new FormData();
        formData.append('phone', cleanPhone);
        if (message) formData.append('caption', message);
        let suffix = 'file';
        if (mediaData.type === 'image') { suffix = 'image'; formData.append('image', fileBlob, 'img.jpg'); }
        endpoint = `${endpoint}/send/${suffix}`;
        bodyContent = formData;
      } else {
        endpoint = `${endpoint}/send/message`;
        bodyContent = JSON.stringify({ phone: cleanPhone, message: message });
      }
    } 
    else {
      headers['apikey'] = channel.api_key;
      if (mediaData?.url) {
         endpoint = `${endpoint}/message/sendMedia/${channel.instance_id}`;
         bodyContent = JSON.stringify({ number: cleanPhone, mediatype: mediaData.type || 'image', media: mediaData.url, caption: message || '' });
      } else {
         endpoint = `${endpoint}/message/sendText/${channel.instance_id}`;
         bodyContent = JSON.stringify({ number: cleanPhone, text: message });
      }
    }

    console.log(`[send-message] Despachando via ${provider} a ${cleanPhone}`);

    const response = await fetch(endpoint, { method: 'POST', headers, body: bodyContent });
    const resText = await response.text();

    if (!response.ok) {
       console.error(`[send-message] Error ${response.status}:`, resText);
       return new Response(JSON.stringify({ success: false, error: resText, status: response.status }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, data: resText }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})