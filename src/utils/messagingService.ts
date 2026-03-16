import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const sendMessage = async (
  phone: string, 
  message: string, 
  leadId: string,
  mediaFile?: { url: string; type: string; mimetype: string; name: string }
) => {
  try {
    // 1. Obtener el lead para saber su canal
    const { data: lead } = await supabase
      .from('leads')
      .select('channel_id')
      .eq('id', leadId)
      .single();

    let channel;
    if (!lead?.channel_id) {
       // Fallback: usar el primer canal activo si no tiene uno asignado
       const { data: firstChannel } = await supabase.from('whatsapp_channels').select('*').eq('is_active', true).limit(1).single();
       channel = firstChannel;
    } else {
       const { data: leadChannel } = await supabase.from('whatsapp_channels').select('*').eq('id', lead.channel_id).single();
       channel = leadChannel;
    }

    if (!channel) throw new Error('No hay canales de WhatsApp activos vinculados.');

    const cleanPhone = phone.replace(/\D/g, '');
    let endpoint = channel.api_url;
    let payload: any = {};
    let headers: any = { 'Content-Type': 'application/json' };

    // ==========================================
    // LÓGICA EVOLUTION API
    // ==========================================
    if (channel.provider === 'evolution') {
      headers['apikey'] = channel.api_key;
      
      if (mediaFile) {
        endpoint = `${channel.api_url}/message/sendMedia/${channel.instance_id}`;
        payload = {
          number: cleanPhone,
          mediatype: mediaFile.type,
          mimetype: mediaFile.mimetype,
          caption: message || "",
          media: mediaFile.url,
          fileName: mediaFile.name
        };
      } else {
        endpoint = `${channel.api_url}/message/sendText/${channel.instance_id}`;
        payload = {
          number: cleanPhone,
          text: message,
          linkPreview: true
        };
      }
    } 
    // ==========================================
    // LÓGICA GOWA (Go-WhatsApp)
    // ==========================================
    else if (channel.provider === 'gowa') {
      headers['Authorization'] = `Bearer ${channel.api_key}`;
      
      if (mediaFile) {
        endpoint = `${channel.api_url}/send-media`;
        payload = {
          phone: cleanPhone,
          media_url: mediaFile.url,
          caption: message,
          type: mediaFile.type
        };
      } else {
        endpoint = `${channel.api_url}/send-message`;
        payload = {
          phone: cleanPhone,
          message: message
        };
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Error ${response.status} en ${channel.provider}`);
    }
    
    return await response.json();

  } catch (error: any) {
    console.error('Messaging Error:', error);
    toast.error(`Fallo Multicanal: ${error.message}`);
    return null;
  }
};

// Deprecated: maintain for compatibility during migration if needed
export const sendEvolutionMessage = sendMessage;