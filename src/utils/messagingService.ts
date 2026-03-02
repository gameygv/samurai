import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Helper to get multiple config values efficiently
const getConfig = async (keys: string[]): Promise<Record<string, string | null>> => {
  const { data, error } = await supabase.from('app_config').select('key, value').in('key', keys);
  if (error) {
    console.error('Could not fetch API configuration:', error);
    throw new Error('No se pudo obtener la configuración de la API.');
  }
  const config = data.reduce((acc, item) => {
    if (item.key) {
      acc[item.key] = item.value;
    }
    return acc;
  }, {} as Record<string, string | null>);
  return config;
};

/**
 * Sends a message directly via the Evolution API.
 * @param phone The recipient's phone number.
 * @param message The text message to send.
 * @returns The API response or null if it fails.
 */
export const sendEvolutionMessage = async (phone: string, message: string) => {
  try {
    const { evolution_api_url, evolution_api_key } = await getConfig(['evolution_api_url', 'evolution_api_key']);
    
    if (!evolution_api_url || !evolution_api_key) {
      throw new Error('La URL o la API Key de Evolution API no están configuradas en Ajustes.');
    }

    const response = await fetch(evolution_api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolution_api_key,
      },
      body: JSON.stringify({
        number: phone,
        options: {
          delay: 1200,
          presence: 'composing',
        },
        textMessage: {
          text: message,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Error en la API de Evolution (Status: ${response.status})`);
    }
    
    return await response.json();

  } catch (error: any) {
    console.error('Error sending Evolution message:', error);
    toast.error(`Error de envío: ${error.message}`);
    return null;
  }
};