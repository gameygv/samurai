import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const getConfig = async (keys: string[]): Promise<Record<string, string | null>> => {
  const { data, error } = await supabase.from('app_config').select('key, value').in('key', keys);
  if (error) throw new Error('No se pudo obtener la configuración de la API.');
  return data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {} as Record<string, string | null>);
};

export const sendEvolutionMessage = async (
  phone: string, 
  message: string, 
  mediaFile?: { url: string; type: string; mimetype: string; name: string }
) => {
  try {
    const { evolution_api_url, evolution_api_key } = await getConfig(['evolution_api_url', 'evolution_api_key']);
    
    if (!evolution_api_url || !evolution_api_key) {
      throw new Error('Configuración incompleta en Ajustes.');
    }

    let endpoint = evolution_api_url;
    let payload: any = {
      number: phone.replace(/\D/g, ''),
    };

    if (mediaFile) {
      // Cambiar el endpoint para envío de multimedia
      endpoint = evolution_api_url.replace('sendText', 'sendMedia');
      
      // Payload compatible con Evolution API v1 y v2
      payload = {
        ...payload,
        mediatype: mediaFile.type,
        mimetype: mediaFile.mimetype,
        caption: message || "",
        media: mediaFile.url,
        fileName: mediaFile.name,
        mediaMessage: {
          mediatype: mediaFile.type,
          caption: message || "",
          media: mediaFile.url,
          fileName: mediaFile.name
        }
      };
    } else {
      payload.text = message;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolution_api_key,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(responseData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    return responseData;

  } catch (error: any) {
    console.error('Evolution Error:', error);
    toast.error(`Fallo de conexión: ${error.message}`);
    return null;
  }
};