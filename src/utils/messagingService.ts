import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const sendMessage = async (
  phone: string, 
  message: string, 
  leadId: string,
  mediaFile?: { url: string; type: string; mimetype: string; name: string }
) => {
  try {
    const { data: lead } = await supabase.from('leads').select('channel_id').eq('id', leadId).single();
    let channel;
    if (!lead?.channel_id) {
       const { data: firstChannel } = await supabase.from('whatsapp_channels').select('*').eq('is_active', true).limit(1).single();
       channel = firstChannel;
    } else {
       const { data: leadChannel } = await supabase.from('whatsapp_channels').select('*').eq('id', lead.channel_id).single();
       channel = leadChannel;
    }

    if (!channel) throw new Error('No hay canales activos.');

    const cleanPhone = phone.replace(/\D/g, '');
    let endpoint = channel.api_url;
    let payload: any = {};
    let headers: any = { 'Content-Type': 'application/json' };

    // ==========================================
    // LÓGICA META CLOUD API (WhatsAPI)
    // ==========================================
    if (channel.provider === 'meta') {
      const version = 'v19.0'; // Versión recomendada
      endpoint = `https://graph.facebook.com/${version}/${channel.instance_id}/messages`;
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      
      if (mediaFile) {
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: mediaFile.type === 'image' ? 'image' : 'document',
          [mediaFile.type === 'image' ? 'image' : 'document']: {
            link: mediaFile.url,
            caption: message
          }
        };
      } else {
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanPhone,
          type: "text",
          text: { body: message }
        };
      }
    } 
    // ==========================================
    // LÓGICA EVOLUTION API
    // ==========================================
    else if (channel.provider === 'evolution') {
      headers['apikey'] = channel.api_key;
      if (mediaFile) {
        endpoint = `${channel.api_url}/message/sendMedia/${channel.instance_id}`;
        payload = { number: cleanPhone, mediatype: mediaFile.type, mimetype: mediaFile.mimetype, caption: message || "", media: mediaFile.url, fileName: mediaFile.name };
      } else {
        endpoint = `${channel.api_url}/message/sendText/${channel.instance_id}`;
        payload = { number: cleanPhone, text: message, linkPreview: true };
      }
    } 
    // ==========================================
    // LÓGICA GOWA
    // ==========================================
    else if (channel.provider === 'gowa') {
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      endpoint = `${channel.api_url}/${mediaFile ? 'send-media' : 'send-message'}`;
      payload = mediaFile ? { phone: cleanPhone, media_url: mediaFile.url, caption: message, type: mediaFile.type } : { phone: cleanPhone, message: message };
    }

    const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Error ${response.status}`);
    }
    return await response.json();
  } catch (error: any) {
    console.error('Messaging Error:', error);
    toast.error(`Fallo: ${error.message}`);
    return null;
  }
};

export const sendEvolutionMessage = sendMessage;