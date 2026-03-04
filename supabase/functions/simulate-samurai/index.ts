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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { question, history, customPrompts } = await req.json();

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find(c => c.key === key)?.value || "";
    
    const apiKey = getConfig('openai_api_key');
    if (!apiKey) throw new Error("OpenAI API Key no encontrada.");

    // 1. Construcción del Link con lógica redundante
    const wcUrl = getConfig('wc_url') || "https://theelephantbowl.com";
    const checkoutPath = getConfig('wc_checkout_path') || "/inscripciones/";
    const productId = getConfig('wc_product_id') || "1483";
    
    const baseUrl = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
    const cleanPath = checkoutPath.startsWith('/') ? checkoutPath : `/${checkoutPath}`;
    
    const basePaymentLink = `${baseUrl}${cleanPath}?add-to-cart=${productId}`;
    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;

    // 2. Prompts
    const pAlma = customPrompts?.prompt_alma_samurai || getConfig('prompt_alma_samurai');
    const pAdn = customPrompts?.prompt_adn_core || getConfig('prompt_adn_core');
    const pEstrategia = customPrompts?.prompt_estrategia_cierre || getConfig('prompt_estrategia_cierre');
    const pRelearning = customPrompts?.prompt_relearning || getConfig('prompt_relearning');

    // 3. Verdad Maestra
    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truth = webContent?.map(w => `[WEB: ${w.title}]\n${w.content}`).join('\n\n') || "Sin datos web.";

    const systemPrompt = `
      CONSTITUCIÓN SAMURAI (MODO SIMULACIÓN):
      
      [ALMA]: ${pAlma}
      [ADN CORE]: ${pAdn}
      [ESTRATEGIA]: ${pEstrategia}
      [BITÁCORA #CIA]: ${pRelearning}
      
      [VERDAD MAESTRA]:
      ${truth}

      === DATOS FINANCIEROS CRÍTICOS ===
      Instrucción: Genera el link de pago usando este formato base:
      ${basePaymentLink}
      
      IMPORTANTE (AUTO-RELLENADO): 
      Si en el historial ya tienes los datos, añade ESTOS parámetros al final del link:
      - &first_name=NOMBRE&last_name=APELLIDO&email=CORREO&city=CIUDAD&phone=TEL
      - &billing_first_name=NOMBRE&billing_last_name=APELLIDO&billing_email=CORREO&billing_city=CIUDAD&billing_phone=TEL
      
      DATOS PARA TRANSFERENCIA:
      ${bankInfo}

      DIRECTIVA: No preguntes datos que ya tengas. Entrega el link completo.
    `;

    const messages = [
        { role: "system", content: "Eres Sam. Responde manteniendo tu tono místico. Al final añade '---JSON---' con layers_used y reasoning." },
        { role: "system", content: systemPrompt }
    ];

    if (history && history.length > 0) {
        history.forEach(msg => {
            messages.push({ role: msg.role === 'bot' ? 'assistant' : 'user', content: msg.text });
        });
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
        explanation: parts[1] ? JSON.parse(parts[1].trim()) : { layers_used: ["FINANZAS"], reasoning: "Link dinámico redundante generado." }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})