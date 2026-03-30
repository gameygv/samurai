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

    // 1. AUTO-RESOLVER CANAL SI NO VIENE EXPLÍCITO (CRÍTICO PARA CAMPAÑAS Y COBRANZA)
    if (!actualChannelId && lead_id) {
       const { data: leadData } = await supabaseClient.from('leads').select('channel_id').eq('id', lead_id).single();
       if (leadData?.channel_id) actualChannelId = leadData.channel_id;
    }

    // 2. FALLBACK AL CANAL POR DEFECTO (Para notificaciones internas a agentes)
    if (!actualChannelId) {
       const { data: cfg } = await supabaseClient.from('app_config').select('value').eq('key', 'default_notification_channel').maybeSingle();
       if (cfg?.value) actualChannelId = cfg.value;
    }

    // 3. FALLBACK DE EMERGENCIA AL PRIMER CANAL ACTIVO
    if (!actualChannelId) {
       const { data: first } = await supabaseClient.from('whatsapp_channels').select('id').eq('is_active', true).limit(1).maybeSingle();
       if (first?.id) actualChannelId = first.id;
    }

    const { data: channel, error: chError } = await supabaseClient
      .from('whatsapp_channels').select('*').eq('id', actualChannelId).single();

    if (chError || !channel) throw new Error("Canal no encontrado en la base de datos.");

    const provider = channel.provider || 'gowa';
    let cleanPhone = phone.replace(/\D/g, '');
    
    let endpoint = channel.api_url;
    if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);

    let headers = { 'Content-Type': 'application/json' };
    let bodyContent: any;

    // ====================================================================
    // 1. GOWA API (Multipart Form-Data para Media)
    // ====================================================================
    if (provider === 'gowa') {
      const authHeader = channel.api_key.startsWith('Basic ') ? channel.api_key : `Basic ${channel.api_key}`;
      headers['Authorization'] = authHeader;
      headers['X-Device-Id'] = channel.instance_id;
      
      if (mediaData?.url) {
        delete headers['Content-Type']; 
        const fileRes = await fetch(mediaData.url);
        const fileBlob = await fileRes.blob();
        
        const formData = new FormData();
        formData.append('phone', cleanPhone);
        if (message) formData.append('caption', message);
        
        let endpointSuffix = 'file';
        if (mediaData.type === 'image') {
            endpointSuffix = 'image';
            formData.append('image', fileBlob, mediaData.name || 'image.jpg');
        } else if (mediaData.type === 'video') {
            endpointSuffix = 'video';
            formData.append('video', fileBlob, mediaData.name || 'video.mp4');
        } else if (mediaData.type === 'audio') {
            endpointSuffix = 'audio';
            formData.append('audio', fileBlob, mediaData.name || 'audio.mp3');
        } else {
            formData.append('file', fileBlob, mediaData.name || 'document.pdf');
        }

        endpoint = `${endpoint}/send/${endpointSuffix}`;
        bodyContent = formData;
      } else {
        endpoint = `${endpoint}/send/message`;
        bodyContent = JSON.stringify({ phone: cleanPhone, message: message });
      }
    } 
    // ====================================================================
    // 2. META CLOUD API OFICIAL (JSON Payload)
    // ====================================================================
    else if (provider === 'meta') {
      // Actualizado a v22.0
      endpoint = `https://graph.facebook.com/v22.0/${channel.instance_id}/messages`;
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      
      if (mediaData?.url) {
         const typeMap = { image: 'image', video: 'video', audio: 'audio', document: 'document' };
         const metaType = typeMap[mediaData.type] || 'document';
         
         bodyContent = JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: metaType,
            [metaType]: { link: mediaData.url, caption: message || '' }
         });
      } else {
         bodyContent = JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: "text",
            text: { body: message }
         });
      }
    } 
    // ====================================================================
    // 3. EVOLUTION API STANDARD (v1/v2)
    // ====================================================================
    else {
      headers['apikey'] = channel.api_key;
      
      if (mediaData?.url) {
         endpoint = `${endpoint}/message/sendMedia/${channel.instance_id}`;
         const evoType = mediaData.type === 'image' ? 'image' : mediaData.type === 'video' ? 'video' : mediaData.type === 'audio' ? 'audio' : 'document';
         bodyContent = JSON.stringify({
             number: cleanPhone,
             mediatype: evoType,
             media: mediaData.url,
             caption: message || ''
         });
      } else {
         endpoint = `${endpoint}/message/sendText/${channel.instance_id}`;
         bodyContent = JSON.stringify({ number: cleanPhone, text: message });
      }
    }

    console.log(`[send-message] Ejecutando POST a: ${endpoint} via ${provider} | Canal: ${channel.name}`);

    const response = await fetch(endpoint, { 
        method: 'POST', 
        headers, 
        body: bodyContent,
        signal: AbortSignal.timeout(15000)
    });

    const resText = await response.text();
    let resData = {};
    try { resData = JSON.parse(resText); } catch(e) { resData = { rawResponse: resText }; }

    if (!response.ok) {
       console.error(`[send-message] Error de servidor (${provider}):`, resText);
       return new Response(JSON.stringify({ 
         success: false, 
         error: resData.message || resData.error || resText || "Error del proveedor de WhatsApp",
         status: response.status 
       }), { 
         status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
       });
    }

    return new Response(JSON.stringify({ success: true, data: resData }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error("[send-message] Excepción capturada:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})