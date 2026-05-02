import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

interface MediaData {
  url?: string;
  type?: string;
  name?: string;
}

interface SendMessagePayload {
  channel_id?: string;
  phone: string;
  message?: string;
  mediaData?: MediaData;
  lead_id?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { channel_id, phone, message, mediaData, lead_id }: SendMessagePayload = await req.json();
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    let actualChannelId = channel_id;

    if (!actualChannelId && lead_id) {
       const { data: leadData } = await supabaseClient.from('leads').select('channel_id').eq('id', lead_id).single();
       if (leadData?.channel_id) actualChannelId = leadData.channel_id;
    }

    if (!actualChannelId) {
       const { data: cfg } = await supabaseClient.from('app_config').select('value').eq('key', 'default_notification_channel').maybeSingle();
       if (cfg?.value) actualChannelId = cfg.value as string;
    }

    if (!actualChannelId) {
       const { data: first } = await supabaseClient.from('whatsapp_channels').select('id').eq('is_active', true).order('created_at', { ascending: true }).limit(1).maybeSingle();
       if (first?.id) actualChannelId = first.id;
    }

    const { data: channel, error: chError } = await supabaseClient
      .from('whatsapp_channels').select('*').eq('id', actualChannelId).single();

    if (chError || !channel) throw new Error("Canal no encontrado.");

    const provider = channel.provider || 'meta';
    let cleanPhone = phone.replace(/\D/g, '');

    // CORRECCIÓN MÉXICO — solo para Meta Cloud API (Gowa usa formato WhatsApp nativo con 521)
    if (provider === 'meta' && cleanPhone.startsWith('521') && cleanPhone.length === 13) {
        cleanPhone = '52' + cleanPhone.substring(3);
    }

    let endpoint = channel.api_url;
    if (endpoint?.endsWith('/')) endpoint = endpoint.slice(0, -1);

    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
    let bodyContent: string | FormData | undefined;

    if (provider === 'meta') {
      endpoint = `https://graph.facebook.com/v21.0/${channel.instance_id}/messages`;
      headers['Authorization'] = `Bearer ${channel.api_key}`;

      if (mediaData?.url) {
         const typeMap: Record<string, string> = { image: 'image', video: 'video', audio: 'audio', document: 'document' };
         const metaType = typeMap[mediaData.type ?? ''] || 'document';
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
      headers['Authorization'] = channel.api_key?.startsWith('Basic ') ? channel.api_key : `Basic ${channel.api_key}`;
      headers['X-Device-Id'] = channel.instance_id ?? '';

      if (mediaData?.url) {
        delete headers['Content-Type'];
        // Comprimir imágenes de Supabase Storage via transform API para evitar 413 nginx
        // width=1200 + quality=85 → buena nitidez en pósters verticales (~200-400KB)
        let downloadUrl = mediaData.url;
        if (mediaData.type === 'image' && downloadUrl.includes('/storage/v1/object/public/')) {
            downloadUrl = downloadUrl.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
            downloadUrl += (downloadUrl.includes('?') ? '&' : '?') + 'width=1200&quality=85&resize=contain';
        }
        const fileRes = await fetch(downloadUrl);
        const fileBlob = await fileRes.blob();
        const formData = new FormData();
        formData.append('phone', cleanPhone);
        if (message) formData.append('caption', message);
        let suffix = 'file';
        // Detectar extensión original para preservar formato (PNG = mejor para texto/pósters)
        const urlPath = (mediaData.url || '').split('?')[0].toLowerCase();
        const isPng = urlPath.endsWith('.png');
        const fileName = isPng ? 'img.png' : 'img.jpg';
        if (mediaData.type === 'image') { suffix = 'image'; formData.append('image', fileBlob, fileName); }
        else if (mediaData.type === 'video') { suffix = 'file'; formData.append('file', fileBlob, mediaData.name || 'video.mp4'); }
        else if (mediaData.type === 'audio') { suffix = 'file'; formData.append('file', fileBlob, mediaData.name || 'audio.ogg'); }
        else { suffix = 'file'; formData.append('file', fileBlob, mediaData.name || 'document.pdf'); }
        endpoint = `${endpoint}/send/${suffix}`;
        bodyContent = formData;
      } else {
        endpoint = `${endpoint}/send/message`;
        bodyContent = JSON.stringify({ phone: cleanPhone, message: message });
      }
    }
    else if (provider === 'manychat') {
      // ManyChat: enviar via API usando subscriber_id del lead
      // El lead debe tener manychat_subscriber_id vinculado
      let mcSubscriberId: string | null = null;
      if (lead_id) {
        const { data: leadMc } = await supabaseClient.from('leads')
          .select('manychat_subscriber_id').eq('id', lead_id).maybeSingle();
        mcSubscriberId = leadMc?.manychat_subscriber_id || null;
      }
      // Fallback: buscar por teléfono mc_XXXXX → subscriber_id XXXXX
      if (!mcSubscriberId && cleanPhone) {
        const { data: leadByPhone } = await supabaseClient.from('leads')
          .select('manychat_subscriber_id').or(`telefono.eq.mc_${cleanPhone},manychat_subscriber_id.eq.${cleanPhone}`)
          .not('manychat_subscriber_id', 'is', null).limit(1).maybeSingle();
        mcSubscriberId = leadByPhone?.manychat_subscriber_id || null;
      }
      if (!mcSubscriberId) {
        return new Response(JSON.stringify({ success: false, error: 'Lead sin manychat_subscriber_id' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Obtener API key de ManyChat
      const { data: mcKeyCfg } = await supabaseClient.from('app_config')
        .select('value').eq('key', 'manychat_api_key').maybeSingle();
      const mcApiKey = mcKeyCfg?.value;
      if (!mcApiKey) {
        return new Response(JSON.stringify({ success: false, error: 'ManyChat API key no configurada' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Determinar endpoint: /fb/ para Messenger, /ig/ para Instagram
      // Usar instance_id del canal para distinguir (page_id de FB)
      const mcPrefix = channel.name?.toLowerCase().includes('instagram') ? 'ig' : 'fb';
      endpoint = `https://api.manychat.com/${mcPrefix}/sending/sendContent`;
      headers['Authorization'] = `Bearer ${mcApiKey}`;

      // Construir payload ManyChat Dynamic Content v2
      // deno-lint-ignore no-explicit-any
      const messages: any[] = [];
      if (message) {
        messages.push({ type: 'text', text: message });
      }
      if (mediaData?.url) {
        if (mediaData.type === 'image') {
          messages.push({ type: 'image', url: mediaData.url });
        } else {
          messages.push({ type: 'file', url: mediaData.url });
        }
      }

      // subscriber_id debe ser numérico en el JSON, pero puede exceder Number.MAX_SAFE_INTEGER
      // (ej: 26575005885494958 > 9007199254740991). Number() pierde precisión.
      // Solución: construir JSON con placeholder y reemplazar como string raw.
      const mcPayload = JSON.stringify({
        subscriber_id: 0,
        data: {
          version: 'v2',
          content: {
            messages,
          },
        },
      });
      bodyContent = mcPayload.replace('"subscriber_id":0', `"subscriber_id":${mcSubscriberId}`);
    }
    else {
      headers['apikey'] = channel.api_key ?? '';
      if (mediaData?.url) {
         endpoint = `${endpoint}/message/sendMedia/${channel.instance_id}`;
         bodyContent = JSON.stringify({ number: cleanPhone, mediatype: mediaData.type || 'image', media: mediaData.url, caption: message || '' });
      } else {
         endpoint = `${endpoint}/message/sendText/${channel.instance_id}`;
         bodyContent = JSON.stringify({ number: cleanPhone, text: message });
      }
    }

    const response = await fetch(endpoint!, { method: 'POST', headers, body: bodyContent });
    const resText = await response.text();

    if (!response.ok) {
       return new Response(JSON.stringify({ success: false, error: resText, status: response.status }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Extract wamid from Meta response (only for meta provider)
    let wamid: string | null = null;
    if (provider === 'meta') {
        try {
            const metaRes = JSON.parse(resText);
            wamid = metaRes?.messages?.[0]?.id || null;
        } catch (_) { /* non-JSON response, wamid stays null */ }
    }

    return new Response(JSON.stringify({ success: true, data: resText, wamid }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ success: false, error: errMsg }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})