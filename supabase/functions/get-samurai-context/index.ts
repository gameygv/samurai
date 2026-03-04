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
    
    // El orden importa: Primero añadimos al carrito, luego pasamos los datos
    let paymentLink = `${baseUrl}${path}?add-to-cart=${productId}`;
    
    if (lead.nombre && !lead.nombre.includes('Nuevo Lead')) {
        const names = lead.nombre.trim().split(' ');
        const fn = encodeURIComponent(names[0]);
        // FunnelKit prefiere billing_first_name o wffn_billing_first_name
        paymentLink += `&billing_first_name=${fn}&wffn_billing_first_name=${fn}&first_name=${fn}`;
    }
    
    if (lead.email) {
       const em = encodeURIComponent(lead.email);
       paymentLink += `&billing_email=${em}&wffn_billing_email=${em}&email=${em}`;
    }
    
    if (lead.telefono) {
       const ph = encodeURIComponent(lead.telefono);
       paymentLink += `&billing_phone=${ph}&wffn_billing_phone=${ph}&phone=${ph}`;
    }
    
    if (lead.ciudad) {
       const ct = encodeURIComponent(lead.ciudad);
       paymentLink += `&billing_city=${ct}&wffn_billing_city=${ct}&city=${ct}`;
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

=== LINK DE PAGO (AUTO-RELLENABLE) ===
Usa este link exacto. Contiene los parámetros billing_ y wffn_ para FunnelKit:
${paymentLink}

=== DATOS TRANSFERENCIA ===
${bankInfo}

[REGLA]: Entrega el link solamente cuando el cliente esté listo para pagar.
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})