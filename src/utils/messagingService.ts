import { supabase } from '@/integrations/supabase/client';

export const sendMessage = async (
  phone: string, 
  message: string, 
  leadId?: string,
  mediaFile?: { url: string; type: string; mimetype: string; name: string },
  explicitChannelId?: string
) => {
  try {
    let channelId = explicitChannelId;
    
    // Si no hay canal explícito, lo buscamos por el lead o el default
    if (!channelId && leadId) {
       const { data: lead } = await supabase.from('leads').select('channel_id').eq('id', leadId).single();
       channelId = lead?.channel_id;
    }

    if (!channelId) {
       const { data: config } = await supabase.from('app_config').select('value').eq('key', 'default_notification_channel').maybeSingle();
       channelId = config?.value;
    }

    let channel;
    if (!channelId) {
       const { data: first } = await supabase.from('whatsapp_channels').select('*').eq('is_active', true).limit(1).single();
       channel = first;
    } else {
       const { data: ch } = await supabase.from('whatsapp_channels').select('*').eq('id', channelId).single();
       channel = ch;
    }

    if (!channel) throw new Error('Sin canales configurados.');

    const cleanPhone = phone.replace(/\D/g, '');
    let endpoint = channel.api_url;
    let payload: any = {};
    let headers: any = { 'Content-Type': 'application/json' };

    // --- LÓGICA GOWA ---
    if (channel.provider === 'gowa') {
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      const baseUrl = channel.api_url.endsWith('/') ? channel.api_url.slice(0, -1) : channel.api_url;
      
      if (mediaFile) {
        endpoint = `${baseUrl}/send-media`;
        payload = { 
            phone: cleanPhone, 
            media_url: mediaFile.url, 
            caption: message || "", 
            type: mediaFile.type,
            instance_id: channel.instance_id 
        };
      } else {
        endpoint = `${baseUrl}/send-message`;
        payload = { 
            phone: cleanPhone, 
            message: message,
            instance_id: channel.instance_id 
        };
      }
    } 
    // --- LÓGICA META ---
    else if (channel.provider === 'meta') {
      endpoint = `https://graph.facebook.com/v19.0/${channel.instance_id}/messages`;
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      if (mediaFile) {
        payload = {
          messaging_product: "whatsapp", to: cleanPhone,
          type: mediaFile.type === 'image' ? 'image' : 'document',
          [mediaFile.type === 'image' ? 'image' : 'document']: { link: mediaFile.url, caption: message }
        };
      } else {
        payload = { messaging_product: "whatsapp", to: cleanPhone, type: "text", text: { body: message } };
      }
    } 
    // --- LÓGICA EVOLUTION ---
    else if (channel.provider === 'evolution') {
      headers['apikey'] = channel.api_key;
      const baseUrl = channel.api_url.endsWith('/') ? channel.api_url.slice(0, -1) : channel.api_url;
      if (mediaFile) {
        endpoint = `${baseUrl}/message/sendMedia/${channel.instance_id}`;
        payload = { number: cleanPhone, mediatype: mediaFile.type, mimetype: mediaFile.mimetype, caption: message || "", media: mediaFile.url, fileName: mediaFile.name };
      } else {
        endpoint = `${baseUrl}/message/sendText/${channel.instance_id}`;
        payload = { number: cleanPhone, text: message };
      }
    }

    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!response.ok) {
       const errorText = await response.text();
       throw new Error(`Error ${response.status}: ${errorText}`);
    }
    return await response.json();

  } catch (error: any) {
    console.error('Messaging Error:', error);
    throw error;
  }
};

export const sendEvolutionMessage = sendMessage;