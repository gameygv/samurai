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

    const evolutionApiUrl = getConfig('evolution_api_url');
    const evolutionApiKey = getConfig('evolution_api_key');
    const openAiKey = getConfig('openai_api_key');
    
    // WooCommerce Keys
    const wcUrl = getConfig('wc_url');
    const wcKey = getConfig('wc_consumer_key');
    const wcSecret = getConfig('wc_consumer_secret');

    const now = new Date();

    // ========================================================
    // 1. WOOCOMMERCE WATCHER: ¿Ya pagaron?
    // ========================================================
    if (wcUrl && wcKey && wcSecret) {
       console.log("[process-followups] Verificando pagos pendientes en WooCommerce...");
       const { data: highIntentLeads } = await supabaseClient
          .from('leads')
          .select('*')
          .eq('buying_intent', 'ALTO')
          .not('email', 'is', null);

       for (const lead of (highIntentLeads || [])) {
          try {
             // Limpiar URL de WC
             const apiBase = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
             const endpoint = `${apiBase}/wp-json/wc/v3/orders?customer=${encodeURIComponent(lead.email)}`;
             
             const auth = btoa(`${wcKey}:${wcSecret}`);
             const wcRes = await fetch(endpoint, {
                headers: { 'Authorization': `Basic ${auth}` }
             });

             if (wcRes.ok) {
                const orders = await wcRes.json();
                // Buscamos algún pedido pagado (processing o completed)
                const paidOrder = orders.find(o => o.status === 'processing' || o.status === 'completed');

                if (paidOrder) {
                   console.log(`[process-followups] ¡VENTA DETECTADA! Lead: ${lead.nombre} (${lead.email})`);
                   
                   // 1. Marcar como GANADO en CRM
                   await supabaseClient.from('leads').update({
                      buying_intent: 'COMPRADO',
                      payment_status: 'VALID',
                      summary: `VENTA AUTOMÁTICA DETECTADA EN WC. Pedido: #${paidOrder.id}`
                   }).eq('id', lead.id);

                   // 2. Enviar mensaje de agradecimiento
                   const thanksMsg = `¡Hola *${lead.nombre}*! 👋 He detectado tu pago correctamente. ¡Muchas gracias por tu confianza! \n\nEn breve recibirás más detalles por correo. ¡Estamos muy felices de que te unas! 😊`;
                   
                   if (evolutionApiUrl && evolutionApiKey) {
                      await fetch(evolutionApiUrl, {
                         method: 'POST',
                         headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
                         body: JSON.stringify({ number: lead.telefono, text: thanksMsg })
                      });
                   }

                   // 3. Log de éxito
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

    // ========================================================
    // 2. PROCESAR ALERTAS Y RECORDATORIOS
    // ========================================================
    // ... (Mantener lógica de recordatorios existente)

    // ========================================================
    // 3. PROCESAR RETARGETINGS AUTOMÁTICOS
    // ========================================================
    // ... (Mantener lógica de retargeting existente)

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("[process-followups] Error crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})