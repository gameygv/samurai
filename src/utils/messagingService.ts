import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const sendMessage = async (
  phone: string, 
  message: string, 
  leadId: string,
  mediaFile?: { url: string; type: string; mimetype: string; name: string }
) => {
  try {
    // 1. Obtener canal específico o el canal de notificaciones por defecto
    const { data: lead } = await supabase.from('leads').select('channel_id').eq('id', leadId).single();
    const { data: config } = await supabase.from('app_config').select('value').eq('key', 'default_notification_channel').maybeSingle();
    
    let channelId = lead?.channel_id || config?.value;
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

    // --- LÓGICA POR PROVEEDOR ---

    if (channel.provider === 'meta') {
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
    else if (channel.provider === 'evolution') {
      headers['apikey'] = channel.api_key;
      if (mediaFile) {
        endpoint = `${channel.api_url}/message/sendMedia/${channel.instance_id}`;
        payload = { number: cleanPhone, mediatype: mediaFile.type, mimetype: mediaFile.mimetype, caption: message || "", media: mediaFile.url, fileName: mediaFile.name };
      } else {
        endpoint = `${channel.api_url}/message/sendText/${channel.instance_id}`;
        payload = { number: cleanPhone, text: message };
      }
    } 
    else if (channel.provider === 'gowa') {
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      endpoint = `${channel.api_url}/${mediaFile ? 'send-media' : 'send-message'}`;
      payload = mediaFile ? { phone: cleanPhone, media_url: mediaFile.url, caption: message, type: mediaFile.type } : { phone: cleanPhone, message: message };
    }

    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
    return response.ok ? await response.json() : null;

  } catch (error: any) {
    console.error('Messaging Error:', error);
    return null;
  }
};

export const sendEvolutionMessage = sendMessage;