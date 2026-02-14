import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Obtiene el valor de una configuración (Webhook o API Key)
 */
export const getConfigValue = async (key: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', key)
    .single();
  
  if (error || !data) return null;
  return data.value;
};

/**
 * Dispara un Webhook de Make.com
 * @param configKey La clave en la tabla app_config (ej: 'webhook_make_corregiria')
 * @param payload El objeto JSON a enviar
 */
export const triggerMakeWebhook = async (configKey: string, payload: any) => {
  try {
    const url = await getConfigValue(configKey);

    if (!url) {
      console.warn(`Webhook URL no configurado para: ${configKey}`);
      toast.error(`Error: Webhook ${configKey} no configurado en Ajustes.`);
      return false;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
        source: 'samurai_panel_v5'
      }),
    });

    if (!response.ok) {
      throw new Error(`Make respondió con status: ${response.status}`);
    }

    return true;
  } catch (error: any) {
    console.error(`Error llamando a Make (${configKey}):`, error);
    toast.error(`Fallo al conectar con Make: ${error.message}`);
    return false;
  }
};