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
    const productId = getConfig('wc_product_id', ""); 
    
    const baseUrl = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
    const path = checkoutPath.startsWith('/') ? checkoutPath : `/${checkoutPath}`;
    
    let paymentLink = `${baseUrl}${path}`;
    let isFirstParam = true;

    // Si hay un producto configurado, lo añadimos. Si está vacío, lo omitimos para evitar redirecciones que borren los datos.
    if (productId && productId.trim() !== '') {
        paymentLink += `?add-to-cart=${productId}`;
        isFirstParam = false;
    }
    
    // Función auxiliar para agregar parámetros correctamente con ? o &
    const addParam = (key, value) => {
        paymentLink += `${isFirstParam ? '?' : '&'}${key}=${value}`;
        isFirstParam = false;
    };
    
    // MAPEADO EXACTO PARA FUNNELKIT
    if (lead.nombre && !lead.nombre.includes('Nuevo Lead')) {
        const names = lead.nombre.trim().split(' ');
        addParam('wffn_billing_first_name', encodeURIComponent(names[0]));
        if (names.length > 1) {
           addParam('wffn_billing_last_name', encodeURIComponent(names.slice(1).join(' ')));
        }
    }
    
    if (lead.email) {
       addParam('wffn_billing_email', encodeURIComponent(lead.email));
    }
    
    if (lead.telefono) {
       addParam('wffn_billing_phone', encodeURIComponent(lead.telefono));
    }
    
    if (lead.ciudad) {
       addParam('wffn_billing_city', encodeURIComponent(lead.ciudad));
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
Usa este link exacto. Ya tiene los campos wffn_billing_ mapeados dinámicamente:
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