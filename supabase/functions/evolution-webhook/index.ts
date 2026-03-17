// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const url = new URL(req.url);
  const channelIdParam = url.searchParams.get('channel_id');
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  if (req.method === 'GET') {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode && token) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Función para registrar CADA paso y saber exactamente dónde falla
  const logTrace = async (msg: string, isError = false) => {
    await supabaseClient.from('activity_logs').insert({
        action: isError ? 'ERROR' : 'UPDATE',
        resource: 'SYSTEM',
        description: `Webhook Trace: ${msg}`,
        status: isError ? 'ERROR' : 'OK'
    });
  };

  try {
    const payloadText = await req.text();
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch (e) {
      await logTrace("Payload rechazado: No es JSON válido", true);
      return new Response("Invalid JSON", { status: 400 });
    }
    
    await logTrace(`Iniciando parseo. Evento: ${payload.event || 'N/A'}`);

    // --- 1. RESOLVER CANAL (CON FALLBACK) ---
    const deviceJid = payload.device_id;
    let channel = null;

    if (channelIdParam) {
       const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', channelIdParam).maybeSingle();
       if (data) channel = data;
    }

    if (!channel && deviceJid) {
       const deviceNum = deviceJid.split('@')[0];
       const { data } = await supabaseClient.from('whatsapp_channels')
          .select('*')
          .or(`instance_id.eq.${deviceNum},instance_id.eq.gowa`)
          .limit(1).maybeSingle();
       if (data) channel = data;
    }

    if (!channel) {
       const { data: defConfig } = await supabaseClient.from('app_config').select('value').eq('key', 'default_notification_channel').maybeSingle();
       if (defConfig?.value) {
           const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', defConfig.value).maybeSingle();
           if (data) channel = data;
       }
    }

    if (!channel) {
       const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('is_active', true).limit(1).maybeSingle();
       if (data) channel = data;
    }

    if (!channel) {
       await logTrace(`Canal definitivo no encontrado.`, true);
       return new Response('invalid_channel', { status: 200 });
    }

    let phone, text = '', pushName = 'Cliente WA', mediaUrl = null, mediaType = null;

    // --- 2. LÓGICA EXACTA GOWA v8.3.0 ---
    if (payload.device_id && payload.event) {
       if (payload.event !== 'message') {
          await logTrace(`Ignorado: Evento no es message (${payload.event})`);
          return new Response('ignored_event', { status: 200 });
       }
       if (!payload.payload) {
          await logTrace(`Abortado: No hay payload`);
          return new Response('no_payload', { status: 200 });
       }
       if (payload.payload.is_from_me) {
          await logTrace(`Ignorado: Mensaje enviado por ti mismo`);
          return new Response('ignored_self', { status: 200 });
       }

       const p = payload.payload;
       phone = p.from;
       pushName = p.from_name || 'Lead Gowa';
       const GOWA_BASE_URL = channel.api_url.endsWith('/') ? channel.api_url.slice(0, -1) : channel.api_url;

       if (p.body) {
         text = p.body;
         mediaType = 'text';
       } else if (p.image) {
         text = "[Imagen]";
         mediaUrl = `${GOWA_BASE_URL}/${p.image}`;
         mediaType = 'image';
       } else if (p.audio) {
         text = "[Audio]";
         const audioPath = p.audio.split(";")[0].trim();
         mediaUrl = `${GOWA_BASE_URL}/${audioPath}`;
         mediaType = 'audio';
       } else if (p.video) {
         text = "[Video]";
         mediaUrl = `${GOWA_BASE_URL}/${p.video}`;
         mediaType = 'video';
       } else if (p.document) {
         text = "[Documento]";
         mediaUrl = `${GOWA_BASE_URL}/${p.document}`;
         mediaType = 'document';
       } else if (p.sticker) {
         text = "[Sticker]";
         mediaUrl = `${GOWA_BASE_URL}/${p.sticker}`;
         mediaType = 'image';
       } else {
         await logTrace(`Ignorado: Mensaje multimedia no soportado`);
         return new Response('unknown_msg_type', { status: 200 });
       }
    } 
    else {
       // --- EVOLUTION FALLBACK ---
       const msg = payload.data?.[0] || payload.data || payload;
       if (msg?.key?.fromMe) return new Response('ignored_self', { status: 200 });
       phone = msg?.key?.remoteJid?.split('@')[0] || payload.phone || payload.sender;
       pushName = payload.pushName || msg?.pushName || 'Lead WA';
       text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || msg?.text || payload.message || '';
    }

    if (!phone) {
       await logTrace(`Abortado: Sin teléfono`);
       return new Response('invalid_phone', { status: 200 });
    }

    // --- 3. LIMPIEZA DE NÚMERO ---
    let cleanPhone = phone.split('@')[0].replace(/\D/g, '');
    if (cleanPhone.startsWith('52') && cleanPhone.length === 12 && cleanPhone[2] !== '1') {
        cleanPhone = '521' + cleanPhone.substring(2);
    }

    await logTrace(`Procesando para el número: ${cleanPhone}`);

    // --- 4. DESCARGA DE MULTIMEDIA ---
    let finalMediaUrl = null;
    if (mediaUrl) {
        try {
            const authHeader = channel.api_key.startsWith('Basic ') ? channel.api_key : `Basic ${channel.api_key}`;
            const mediaRes = await fetch(mediaUrl, { headers: { 'Authorization': authHeader } });
            
            if (mediaRes.ok) {
                const blob = await mediaRes.blob();
                const ext = mediaUrl.split('.').pop()?.split('?')[0] || 'bin';
                const fileName = `inbound/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
                const { data: uploadData } = await supabaseClient.storage.from('media').upload(fileName, blob, { contentType: blob.type });
                
                if (uploadData) {
                    const { data: { publicUrl } } = supabaseClient.storage.from('media').getPublicUrl(fileName);
                    finalMediaUrl = publicUrl;
                }
            } else {
                await logTrace(`Error bajando adjunto HTTP ${mediaRes.status}`, true);
            }
        } catch (e) {
            await logTrace(`Excepción bajando adjunto: ${e.message}`, true);
        }
    }

    // --- 5. ACTUALIZAR CRM ---
    let { data: lead, error: searchErr } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone.slice(-10)}%`).limit(1).maybeSingle();
    
    if (searchErr) {
        await logTrace(`Error BD al buscar lead: ${searchErr.message}`, true);
        throw searchErr;
    }

    if (!lead) {
      // AQUÍ ESTABA EL ERROR: quitamos platform: 'WHATSAPP' que rompía todo
      const { data: nl, error: insErr } = await supabaseClient.from('leads').insert({ 
        nombre: pushName, 
        telefono: cleanPhone, 
        channel_id: channel.id
      }).select().single();
      
      if (insErr) {
         await logTrace(`Fallo BD insertando Lead: ${insErr.message}`, true);
         throw insErr;
      }
      lead = nl;
    } else {
      await supabaseClient.from('leads').update({ 
        last_message_at: new Date().toISOString(), 
        channel_id: channel.id 
      }).eq('id', lead.id);
    }

    // A la tabla de conversaciones sí le pasamos el platform
    const { error: convErr } = await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, 
        emisor: 'CLIENTE', 
        mensaje: text || " ", 
        platform: 'WHATSAPP',
        metadata: finalMediaUrl ? { mediaUrl: finalMediaUrl, mediaType } : {}
    });

    if (convErr) {
       await logTrace(`Fallo BD guardando chat: ${convErr.message}`, true);
       throw convErr;
    }

    await logTrace(`¡Éxito! Mensaje guardado en CRM para: ${lead.nombre}`);

    // --- 6. LANZAR IA ---
    if (!lead.ai_paused) {
       let samuraiUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-samurai-response?phone=${cleanPhone}&client_message=${encodeURIComponent(text)}`;
       if (finalMediaUrl) samuraiUrl += `&media_url=${encodeURIComponent(finalMediaUrl)}&media_type=${mediaType}`;
       fetch(samuraiUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` } }).catch(() => {});
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    // AHORA CAPTURAMOS CUALQUIER OTRA FALLA EN EL UI
    await logTrace(`CRASH FATAL: ${err.message}`, true);
    console.error("[evolution-webhook] Error Fatal:", err.message);
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});