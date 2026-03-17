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
    
    // Si no hay canal explícito, lo buscamos por el lead
    if (!channelId && leadId) {
       const { data: lead } = await supabase.from('leads').select('channel_id').eq('id', leadId).single();
       channelId = lead?.channel_id;
    }

    // Si aún no hay, usamos el de sistema
    if (!channelId) {
       const { data: config } = await supabase.from('app_config').select('value').eq('key', 'default_notification_channel').maybeSingle();
       channelId = config?.value;
    }

    // Si no hay configuración ninguna, fallamos
    if (!channelId) {
       const { data: first } = await supabase.from('whatsapp_channels').select('id').eq('is_active', true).limit(1).maybeSingle();
       channelId = first?.id;
    }

    if (!channelId) throw new Error('No hay canales de WhatsApp configurados o activos.');

    // Llamamos a la Edge Function (el túnel) para evitar CORS
    const { data, error } = await supabase.functions.invoke('send-message-v3', {
      body: {
        channel_id: channelId,
        phone,
        message,
        mediaData: mediaFile
      }
    });

    if (error) throw error;
    if (data?.success === false) throw new Error(JSON.stringify(data.error));

    return data;

  } catch (error: any) {
    console.error('Messaging Error:', error);
    throw error;
  }
};

export const sendEvolutionMessage = sendMessage;