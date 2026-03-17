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
    const { channel_id, phone, message, mediaData } = await req.json();
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

    const { data: channel, error: chError } = await supabaseClient
      .from('whatsapp_channels').select('*').eq('id', channel_id).single();

    if (chError || !channel) throw new Error("Canal no encontrado en la base de datos.");

    const provider = channel.provider || 'gowa';
    let cleanPhone = phone.replace(/\D/g, '');
    
    let endpoint = channel.api_url;
    if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);

    let headers = { 'Content-Type': 'application/json' };
    let bodyContent: any;

    // --- LÓGICA GOWA ESTRICTA SEGÚN REPORTE ---
    if (provider === 'gowa') {
      // 1. Basic Auth
      const authHeader = channel.api_key.startsWith('Basic ') ? channel.api_key : `Basic ${channel.api_key}`;
      headers['Authorization'] = authHeader;
      
      // 2. X-Device-Id Header
      headers['X-Device-Id'] = channel.instance_id;
      
      if (mediaData?.url) {
        // 3. Enviar Media como multipart/form-data
        delete headers['Content-Type']; // fetch lo asigna automáticamente para form-data
        
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
        // Enviar texto normal
        endpoint = `${endpoint}/send/message`;
        bodyContent = JSON.stringify({ phone: cleanPhone, message: message });
      }
    } 
    else if (provider === 'meta') {
      endpoint = `https://graph.facebook.com/v19.0/${channel.instance_id}/messages`;
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      bodyContent = JSON.stringify({ messaging_product: "whatsapp", to: cleanPhone, type: "text", text: { body: message } });
    } 
    else {
      // Evolution Standard
      headers['apikey'] = channel.api_key;
      endpoint = `${endpoint}/message/sendText/${channel.instance_id}`;
      bodyContent = JSON.stringify({ number: cleanPhone, text: message });
    }

    console.log(`[send-message] Ejecutando POST a: ${endpoint}`);

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
       console.error("[send-message] Error de servidor Gowa:", resText);
       return new Response(JSON.stringify({ 
         success: false, 
         error: resData.message || resData.error || resText || "Error del servidor Gowa",
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