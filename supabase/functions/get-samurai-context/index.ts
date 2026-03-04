// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    
    const body = await req.json().catch(() => ({}));
    const lead = body.lead || {};

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string, def = "") => configs?.find((c: any) => c.key === key)?.value || def;

    const wcUrl = getConfig('wc_url', "https://theelephantbowl.com");
    const checkoutPath = getConfig('wc_checkout_path', "/inscripciones/");
    const productId = getConfig('wc_product_id', "1483"); 
    
    const baseUrl = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
    const path = checkoutPath.startsWith('/') ? checkoutPath : `/${checkoutPath}`;
    
    // Link Base: Dominio + Checkout + Añadir Producto
    let paymentLink = `${baseUrl}${path}?add-to-cart=${productId}`;
    
    // MAPEADO EXACTO SEGÚN CAPTURA FUNNELKIT
    if (lead.nombre && !lead.nombre.includes('Nuevo Lead')) {
        const names = lead.nombre.trim().split(' ');
        const fn = encodeURIComponent(names[0]);
        // Parámetro exacto: wffn_billing_first_name
        paymentLink += `&wffn_billing_first_name=${fn}`;
        
        if (names.length > 1) {
           const ln = encodeURIComponent(names.slice(1).join(' '));
           // Parámetro exacto: wffn_billing_last_name
           paymentLink += `&wffn_billing_last_name=${ln}`;
        }
    }
    
    if (lead.email) {
       const em = encodeURIComponent(lead.email);
       // Parámetro exacto: wffn_billing_email
       paymentLink += `&wffn_billing_email=${em}`;
    }
    
    if (lead.telefono) {
       const ph = encodeURIComponent(lead.telefono);
       // Parámetro exacto: wffn_billing_phone
       paymentLink += `&wffn_billing_phone=${ph}`;
    }
    
    if (lead.ciudad) {
       const ct = encodeURIComponent(lead.ciudad);
       // Parámetro exacto: wffn_billing_city
       paymentLink += `&wffn_billing_city=${ct}`;
    }

    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;
    const pAlma = getConfig('prompt_alma_samurai');
    const pAdn = getConfig('prompt_adn_core');
    const pEstrategia = getConfig('prompt_estrategia_cierre');

    const systemPrompt = `
=== CONSTITUCIÓN TÁCTICA ===
${pAlma}
${pAdn}
${pEstrategia}

=== LINK DE PAGO (MAPEO FUNNELKIT OK) ===
Usa este link exacto. Ya tiene los campos wffn_billing_ mapeados:
${paymentLink}

=== DATOS PARA TRANSFERENCIA ===
${bankInfo}

[REGLA]: Entrega el link solamente si el cliente ya te dio su Ciudad y Email.
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})