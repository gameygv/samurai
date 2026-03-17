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

  const logTrace = async (msg: string, isError = false) => {
    await supabaseClient.from('activity_logs').insert({
        action: isError ? 'ERROR' : 'UPDATE', resource: 'SYSTEM',
        description: `Webhook Trace: ${msg}`, status: isError ? 'ERROR' : 'OK'
    });
  };

  try {
    const payloadText = await req.text();
    let payload;
    try { payload = JSON.parse(payloadText); } catch (e) { return new Response("Invalid JSON", { status: 400 }); }
    
    // --- 1. RESOLVER CANAL ---
    let channel = null;
    const deviceJid = payload.device_id;

    if (channelIdParam) {
       const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', channelIdParam).maybeSingle();
       if (data) channel = data;
    }
    if (!channel && deviceJid) {
       const deviceNum = deviceJid.split('@')[0];
       const { data } = await supabaseClient.from('whatsapp_channels').select('*').or(`instance_id.eq.${deviceNum},instance_id.eq.gowa`).limit(1).maybeSingle();
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
    if (!channel) return new Response('invalid_channel', { status: 200 });

    let phone, text = '', pushName = 'Cliente WA', mediaUrl = null, mediaType = null;

    // --- 2. PARSEAR MENSAJE GOWA / EVOLUTION ---
    if (payload.device_id && payload.event) { // Flujo GOWA
       if (payload.event !== 'message') return new Response('ignored_event', { status: 200 });
       if (!payload.payload || payload.payload.is_from_me) return new Response('ignored_self', { status: 200 });

       const p = payload.payload;
       phone = p.from;
       pushName = p.from_name || 'Lead Gowa';
       const GOWA_BASE_URL = channel.api_url.endsWith('/') ? channel.api_url.slice(0, -1) : channel.api_url;

       if (p.body) {
         text = p.body;
       } else if (p.image) {
         text = "[Imagen]"; mediaUrl = `${GOWA_BASE_URL}/${p.image}`; mediaType = 'image';
       } else if (p.audio) {
         text = "[Audio]"; const audioPath = p.audio.split(";")[0].trim(); mediaUrl = `${GOWA_BASE_URL}/${audioPath}`; mediaType = 'audio';
       } else if (p.video) {
         text = "[Video]"; mediaUrl = `${GOWA_BASE_URL}/${p.video}`; mediaType = 'video';
       } else if (p.document) {
         text = "[Documento]"; mediaUrl = `${GOWA_BASE_URL}/${p.document}`; mediaType = 'document';
       } else if (p.sticker) {
         text = "[Sticker]"; mediaUrl = `${GOWA_BASE_URL}/${p.sticker}`; mediaType = 'image';
       }
    } else { // Flujo Evolution API Genérico
       if (payload.event && payload.event !== 'messages.upsert') return new Response('ignored_event', { status: 200 });
       
       const msg = payload.data?.[0] || payload.data || payload;
       if (msg?.key?.fromMe || payload.fromMe) return new Response('ignored_self', { status: 200 });
       
       phone = msg?.key?.remoteJid?.split('@')[0] || payload.phone || payload.sender;
       pushName = payload.pushName || msg?.pushName || 'Lead WA';
       
       if (msg?.message?.imageMessage) { text = "[Imagen]"; mediaType = 'image'; } 
       else if (msg?.message?.audioMessage) { text = "[Audio]"; mediaType = 'audio'; } 
       else { text = msg?.message?.conversation || msg?.message?.extendedTextMessage?.text || msg?.text || payload.message || ''; }
    }

    if (!phone) return new Response('invalid_phone', { status: 200 });

    // 🛑 ROMPE-BUCLES CRÍTICO: Si no hay texto real ni adjunto, lo ignoramos. (Evita que los "Visto" rompan la IA)
    if (!text.trim() && !mediaUrl && !mediaType) {
        await logTrace(`IGNORADO: Evento de sistema sin contenido para ${phone}`);
        return new Response('empty_message_ignored', { status: 200 });
    }

    let cleanPhone = phone.split('@')[0].replace(/\D/g, '');
    if (cleanPhone.startsWith('52') && cleanPhone.length === 12 && cleanPhone[2] !== '1') cleanPhone = '521' + cleanPhone.substring(2);

    // --- 3. DESCARGA MULTIMEDIA ---
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
                if (uploadData) finalMediaUrl = supabaseClient.storage.from('media').getPublicUrl(fileName).data.publicUrl;
            }
        } catch (e) { await logTrace(`Error bajando adjunto: ${e.message}`, true); }
    }

    // --- 4. ACTUALIZAR CRM ---
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone.slice(-10)}%`).limit(1).maybeSingle();
    
    if (!lead) {
      const { data: nl } = await supabaseClient.from('leads').insert({ nombre: pushName, telefono: cleanPhone, channel_id: channel.id }).select().single();
      lead = nl;
    } else {
      await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString(), channel_id: channel.id }).eq('id', lead.id);
    }

    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, emisor: 'CLIENTE', mensaje: text, platform: 'WHATSAPP',
        metadata: finalMediaUrl ? { mediaUrl: finalMediaUrl, mediaType } : {}
    });

    await logTrace(`Mensaje de ${lead.nombre} procesado correctamente.`);

    // --- 5. LÓGICA IA ---
    if (!lead.ai_paused) {
       const { data: configs } = await supabaseClient.from('app_config').select('key, value');
       const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
       const openaiKey = configMap['openai_api_key'];

       if (openaiKey) {
          // A. Construir el contexto del sistema
          const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
          let masterTruth = "\n=== VERDAD MAESTRA (SITIO WEB) ===\n";
          webPages?.forEach(p => { if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 1500)}\n`; });

          const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER');
          let mediaContext = "\n=== BÓVEDA VISUAL (POSTERS) ===\nINSTRUCCIÓN CRÍTICA: Para enviar un poster usa EXACTAMENTE este formato en tu respuesta: <<MEDIA:url_del_poster>>\n";
          mediaAssets?.forEach(m => { mediaContext += `- ${m.title}: ${m.ai_instructions} -> <<MEDIA:${m.url}>>\n`; });

          const bankInfo = `Banco: ${configMap['bank_name']}\nCuenta: ${configMap['bank_account']}\nCLABE: ${configMap['bank_clabe']}\nTitular: ${configMap['bank_holder']}`;

          const systemPrompt = `
            ${configMap['prompt_alma_samurai']}
            ${configMap['prompt_adn_core']}
            ${configMap['prompt_behavior_rules']}
            ${masterTruth}
            ${mediaContext}
            === DATOS DE PAGO ===
            ${bankInfo}
          `;

          // B. RECUPERAR MEMORIA (HISTORIAL)
          // Esto evita la "Amnesia" y que la IA se presente una y otra vez.
          const { data: historyData } = await supabaseClient.from('conversaciones')
             .select('emisor, mensaje')
             .eq('lead_id', lead.id)
             .order('created_at', { ascending: false })
             .limit(12);

          const history = (historyData || []).reverse();
          const messages = [ { role: 'system', content: systemPrompt } ];

          history.forEach(h => {
             // Formateamos el historial para que OpenAI entienda la conversación
             if (h.emisor === 'CLIENTE') {
                 messages.push({ role: 'user', content: h.mensaje || '[Adjunto]' });
             } else if (['IA', 'SAMURAI', 'HUMANO'].includes(h.emisor)) {
                 messages.push({ role: 'assistant', content: h.mensaje || '[Archivo Enviado]' });
             }
          });

          // C. Llamar a OpenAI con todo el historial
          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.4 })
          });

          const aiData = await aiRes.json();
          let aiText = aiData.choices?.[0]?.message?.content || '';

          if (aiText) {
             let mediaUrlToSend = null;
             const match = aiText.match(/<<MEDIA:\s*(.+?)\s*>>/i);
             if (match) {
                mediaUrlToSend = match[1].trim();
                aiText = aiText.replace(match[0], '').trim();
             }

             // Enviar a WhatsApp a través del túnel
             await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-message-v3`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    channel_id: lead.channel_id || channel.id, 
                    phone: cleanPhone, 
                    message: aiText,
                    mediaData: mediaUrlToSend ? { url: mediaUrlToSend, type: 'image', name: 'poster.jpg' } : undefined
                })
             });

             // Guardar respuesta de la IA en la base de datos
             await supabaseClient.from('conversaciones').insert({ 
                lead_id: lead.id, emisor: 'SAMURAI', mensaje: aiText || "[Poster Enviado]", platform: 'WHATSAPP',
                metadata: mediaUrlToSend ? { mediaUrl: mediaUrlToSend, mediaType: 'image' } : {}
             });
          }
       }
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err) {
    await logTrace(`ERROR CRÍTICO: ${err.message}`, true);
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});