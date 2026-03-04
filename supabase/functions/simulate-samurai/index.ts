// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { question, history, customPrompts } = await req.json();

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find(c => c.key === key)?.value || "";
    
    const apiKey = getConfig('openai_api_key');
    if (!apiKey) throw new Error("OpenAI API Key no encontrada.");

    const wcUrl = getConfig('wc_url') || "https://theelephantbowl.com";
    const checkoutPath = getConfig('wc_checkout_path') || "/inscripciones/";
    const productId = getConfig('wc_product_id') || "";
    
    const baseUrl = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
    const cleanPath = checkoutPath.startsWith('/') ? checkoutPath : `/${checkoutPath}`;
    
    let basePaymentLink = `${baseUrl}${cleanPath}`;
    let isFirst = true;

    if (productId && productId.trim() !== '') {
        basePaymentLink += `?add-to-cart=${productId}`;
        isFirst = false;
    }
    
    const separator = isFirst ? '?' : '&';

    const systemPrompt = `
      [ADN]: ${customPrompts?.prompt_adn_core || getConfig('prompt_adn_core')}
      [VENTA]: ${customPrompts?.prompt_estrategia_cierre || getConfig('prompt_estrategia_cierre')}

      === GENERACIÓN DE LINK FUNNELKIT ===
      Debes usar exactamente este formato para los parámetros dinámicos:
      ${basePaymentLink}${separator}wffn_billing_first_name=NOMBRE&wffn_billing_email=CORREO&wffn_billing_city=CIUDAD
      
      IMPORTANTE: Tu WordPress usa el prefijo "wffn_billing_". No lo cambies.
    `;

    const messages = [
        { role: "system", content: "Eres Sam. Al final añade '---JSON---' con layers_used y reasoning." },
        { role: "system", content: systemPrompt }
    ];

    if (history && history.length > 0) {
        history.forEach(msg => messages.push({ role: msg.role === 'bot' ? 'assistant' : 'user', content: msg.text }));
    } else {
        messages.push({ role: "user", content: question });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: "gpt-4o", messages: messages, temperature: 0.5 })
    });

    const aiData = await response.json();
    const rawText = aiData.choices[0].message.content;
    const parts = rawText.split('---JSON---');
    
    return new Response(JSON.stringify({ 
        answer: parts[0].trim(), 
        explanation: parts[1] ? JSON.parse(parts[1].trim()) : { layers_used: ["FUNNELKIT"], reasoning: "Link wffn_billing_ generado correctamente." }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})