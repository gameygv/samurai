// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  console.log("[process-followups] Iniciando ciclo AI-Driven + WooCommerce Watcher...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key) => configs?.find(c => c.key === key)?.value || null;
    
    // WooCommerce Keys
    const wcUrl = getConfig('wc_url');
    const wcKey = getConfig('wc_consumer_key');
    const wcSecret = getConfig('wc_consumer_secret');

    // ========================================================
    // 1. WOOCOMMERCE WATCHER: ¿Ya pagaron?
    // ========================================================
    if (wcUrl && wcKey && wcSecret) {
       console.log("[process-followups] Verificando pagos pendientes en WooCommerce...");
       const { data: highIntentLeads } = await supabaseClient
          .from('leads')
          .select('id, nombre, email, telefono, channel_id')
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
                   console.log(`[process-followups] ¡VENTA DETECTADA! Lead: ${lead.nombre} (${lead.email})`);
                   
                   await supabaseClient.from('leads').update({
                      buying_intent: 'COMPRADO',
                      payment_status: 'VALID',
                      summary: `VENTA AUTOMÁTICA DETECTADA EN WC. Pedido: #${paidOrder.id}`
                   }).eq('id', lead.id);

                   const thanksMsg = `¡Hola *${lead.nombre}*! 👋 He detectado tu pago correctamente. ¡Muchas gracias por tu confianza! \n\nEn breve recibirás más detalles por correo. ¡Estamos muy felices de que te unas! 😊`;
                   
                   // ENVIAR POR EL TÚNEL MULTICANAL MANTENIENDO EL CANAL ORIGINAL DEL LEAD
                   await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-message-v3`, {
                      method: 'POST',
                      headers: { 
                         'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`, 
                         'Content-Type': 'application/json' 
                      },
                      body: JSON.stringify({ 
                          channel_id: lead.channel_id,
                          phone: lead.telefono, 
                          message: thanksMsg 
                      })
                   });

                   await supabaseClient.from('activity_logs').insert({
                      action: 'UPDATE', resource: 'LEADS', 
                      description: `💰 Venta cerrada AUTO: ${lead.nombre} via WooCommerce`,
                      status: 'OK'
                   });
                }
             }
          } catch (e) {
             console.error(`[WC-Watcher] Error revisando lead ${lead.email}:`, e.message);
          }
       }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("[process-followups] Error crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})