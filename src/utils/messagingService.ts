import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const getConfig = async (keys: string[]): Promise<Record<string, string | null>> => {
  const { data, error } = await supabase.from('app_config').select('key, value').in('key', keys);
  if (error) throw new Error('No se pudo obtener la configuración de la API.');
  return data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {} as Record<string, string | null>);
};

export const sendEvolutionMessage = async (phone: string, message: string) => {
  try {
    const { evolution_api_url, evolution_api_key } = await getConfig(['evolution_api_url', 'evolution_api_key']);
    
    if (!evolution_api_url || !evolution_api_key) {
      throw new Error('Configuración incompleta en Ajustes.');
    }

    // Estructura universal para Evolution API (v1 y v2)
    const payload = {
      number: phone.replace(/\D/g, ''), // Limpia cualquier carácter no numérico
      text: message
    };

    const response = await fetch(evolution_api_url, {
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