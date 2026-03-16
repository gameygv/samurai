// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  console.log("[process-followups] Iniciando ciclo AI-Driven + WooCommerce Watcher + Meta CAPI...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key) => configs?.find(c => c.key === key)?.value || null;

    const evolutionApiUrl = getConfig('evolution_api_url');
    const evolutionApiKey = getConfig('evolution_api_key');
    
    // Config CAPI
    const pixelId = getConfig('meta_pixel_id');
    const accessToken = getConfig('meta_access_token');

    // WooCommerce Keys
    const wcUrl = getConfig('wc_url');
    const wcKey = getConfig('wc_consumer_key');
    const wcSecret = getConfig('wc_consumer_secret');

    // 1. WOOCOMMERCE WATCHER: ¿Ya pagaron?
    if (wcUrl && wcKey && wcSecret) {
       const { data: highIntentLeads } = await supabaseClient
          .from('leads')
          .select('*')
          .eq('buying_intent', 'ALTO')
          .not('email', 'is', null);

       for (const lead of (highIntentLeads || [])) {
          try {
             const apiBase = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
             const endpoint = `${apiBase}/wp-json/wc/v3/orders?customer=${encodeURIComponent(lead.email)}`;
             
             const auth = btoa(`${wcKey}:${wcSecret}`);
             const wcRes = await fetch(endpoint, {
                headers: { 'Authorization': `Basic ${auth}` }
             });

             if (wcRes.ok) {
                const orders = await wcRes.json();
                const paidOrder = orders.find(o => o.status === 'processing' || o.status === 'completed');

                if (paidOrder) {
                   console.log(`[process-followups] ¡VENTA DETECTADA! Lead: ${lead.nombre}`);
                   
                   // A. Marcar como GANADO
                   await supabaseClient.from('leads').update({
                      buying_intent: 'COMPRADO',
                      payment_status: 'VALID',
                      summary: `VENTA AUTO WC. Pedido: #${paidOrder.id}`
                   }).eq('id', lead.id);

                   // B. Disparar CAPI 'Purchase'
                   if (pixelId && accessToken) {
                      const eventData = {
                          event_name: 'Purchase',
                          lead_id: lead.id,
                          value: parseFloat(paidOrder.total) || 1500,
                          currency: paidOrder.currency || 'MXN',
                          user_data: {
                              em: lead.email,
                              ph: lead.telefono,
                              fn: lead.nombre,
                              ln: lead.apellido,
                              ct: lead.ciudad,
                              country: 'mx',
                              external_id: lead.id
                          },
                          custom_data: { order_id: String(paidOrder.id), source: 'wc_watcher_auto' }
                      };

                      await supabaseClient.functions.invoke('meta-capi-sender', {
                          body: { 
                              eventData, 
                              config: { pixel_id: pixelId, access_token: accessToken } 
                          }
                      });
                   }

                   // C. Mensaje de agradecimiento
                   const thanksMsg = `¡Hola *${lead.nombre}*! 👋 He detectado tu pago correctamente. ¡Muchas gracias por tu confianza! \n\nEn breve recibirás más detalles por correo. ¡Estamos muy felices de que te unas! 😊`;
                   
                   if (evolutionApiUrl && evolutionApiKey) {
                      await fetch(evolutionApiUrl, {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
                         body: JSON.stringify({ number: lead.telefono, text: thanksMsg })
                      });
                   }

                   await supabaseClient.from('activity_logs').insert({
                      action: 'UPDATE', resource: 'LEADS', 
                      description: `💰 Venta cerrada y CAPI enviada: ${lead.nombre}`,
                      status: 'OK'
                   });
                }
             }
          } catch (e) {
             console.error(`[WC-Watcher] Error:`, e.message);
          }
       }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})