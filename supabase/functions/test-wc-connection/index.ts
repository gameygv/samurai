// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { wc_url, wc_key, wc_secret } = await req.json();

    if (!wc_url || !wc_key || !wc_secret) {
        throw new Error("Faltan credenciales de WooCommerce.");
    }

    const apiBase = wc_url.endsWith('/') ? wc_url.slice(0, -1) : wc_url;
    const endpoint = `${apiBase}/wp-json/wc/v3/system_status`;
    const auth = btoa(`${wc_key}:${wc_secret}`);

    const wcRes = await fetch(endpoint, { 
        headers: { 'Authorization': `Basic ${auth}` },
        signal: AbortSignal.timeout(10000)
    });

    if (!wcRes.ok) {
        const errorText = await wcRes.text();
        throw new Error(`HTTP ${wcRes.status}: Verifique que la URL y las claves sean correctas.`);
    }

    const data = await wcRes.json();

    return new Response(JSON.stringify({ 
        success: true, 
        message: "Conexión exitosa a WooCommerce.",
        environment: data.environment?.site_url
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})