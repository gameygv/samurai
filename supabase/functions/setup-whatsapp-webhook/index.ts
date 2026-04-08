// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  
  try {
    const { channel } = await req.json();
    if (!channel || !channel.api_url || !channel.api_key || !channel.instance_id) {
        throw new Error("Datos del canal incompletos.");
    }

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/evolution-webhook?channel_id=${channel.id}`;
    
    let endpoint = channel.api_url;
    if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
    
    const authHeader = channel.api_key.startsWith('Basic ') ? channel.api_key : `Bearer ${channel.api_key}`;
    const headers = {
       'Content-Type': 'application/json',
       'Authorization': authHeader,
       'X-Device-Id': channel.instance_id,
       'apikey': channel.api_key // Evolution API
    };

    const urlToCall = `${endpoint}/webhook`; 
    const bodyToCall = { 
       url: webhookUrl, 
       enabled: true, 
       webhook: webhookUrl, // Evolution v1 fallback
       events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE"] // Evolution v2 asegura salientes
    }; 
    
    console.log(`[Webhook-Setup] Enviando inyección a ${urlToCall} para el instance: ${channel.instance_id}`);

    const response = await fetch(urlToCall, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyToCall)
    });

    const text = await response.text();
    if (!response.ok) throw new Error(`Servidor Gowa rechazó la petición (${response.status}): ${text}`);

    return new Response(JSON.stringify({ success: true, meta: text }), { 
       headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (err: any) {
    console.error("[Webhook-Setup] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
       status: 200, 
       headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});