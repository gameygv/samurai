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
    
    const baseUrl = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
    const path = checkoutPath.startsWith('/') ? checkoutPath : `/${checkoutPath}`;
    
    // CARGAR CATÁLOGO DE PRODUCTOS EN EL SIMULADOR
    let products = [];
    try {
       const prodStr = getConfig('wc_products') || '[]';
       products = JSON.parse(prodStr);
    } catch(e) {}

    let catalogContext = "\n=== CATÁLOGO DE PRODUCTOS (ENLACES DE PAGO) ===\n";
    if (products.length > 0) {
        catalogContext += "Usa ESTOS enlaces específicos según lo que el cliente quiera comprar. Entrégalo SOLO UNA VEZ en toda la conversación y solo cuando estés en fase de cierre (cuando ya te dio su correo y ciudad).\n\n";
        products.forEach((p: any) => {
            const finalLink = `${baseUrl}${path}?add-to-cart=${p.wc_id}&wffn_billing_email=test@simulador.com`;
            catalogContext += `[PRODUCTO]: ${p.title} ($${p.price})\n`;
            catalogContext += `[LINK EXACTO PARA ENVIAR]: ${finalLink}\n`;
            catalogContext += `[CUÁNDO OFRECERLO]: ${p.prompt}\n\n`;
        });
    } else {
        catalogContext += "No hay productos configurados en el catálogo.\n";
    }

    // CARGAR POSTERS
    const { data: mediaAssets } = await supabaseClient
        .from('media_assets')
        .select('title, url, ai_instructions, ocr_content, category')
        .eq('category', 'POSTER');

    let mediaContext = "\n=== BÓVEDA DE POSTERS (MEDIA MANAGER) ===\n";
    if (mediaAssets && mediaAssets.length > 0) {
        mediaContext += `INSTRUCCIÓN CRÍTICA DE VISUALES: Cuando el cliente pida información o cuando ya sepas su CIUDAD, DEBES adjuntar el poster correspondiente AUTOMÁTICAMENTE. REGLA DE MEMORIA: NUNCA envíes el mismo poster dos veces. Pega la etiqueta exacta <<MEDIA:URL>>.\n\n`;
        mediaAssets.forEach(m => {
            mediaContext += `- TÍTULO: ${m.title}\n  OCR: ${m.ocr_content || 'Sin información extraída'}\n  CUÁNDO USAR: ${m.ai_instructions}\n  ETIQUETA EXACTA: <<MEDIA:${m.url}>>\n\n`;
        });
    }

    // CARGAR VERDAD MAESTRA (SITIO WEB)
    const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    let masterTruth = "\n=== VERDAD MAESTRA (SITIO WEB OFICIAL) ===\n";
    if (webPages && webPages.length > 0) {
        masterTruth += "Esta es la información OFICIAL. NUNCA inventes nombres ni datos que no estén aquí.\n";
        webPages.forEach(p => {
            if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 3000)}\n`;
        });
    }

    // CARGAR BASE DE CONOCIMIENTO
    const { data: kbDocs } = await supabaseClient.from('knowledge_documents').select('title, category, content, description');
    let kbContext = "\n=== BASE DE CONOCIMIENTO TÉCNICO ===\n";
    if (kbDocs && kbDocs.length > 0) {
        kbDocs.forEach(d => {
            if(d.content) kbContext += `\n[RECURSO: ${d.title} | CAT: ${d.category}]\nContenido: ${d.content.substring(0, 2000)}\n`;
        });
    }

    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;
    const pRelearning = getConfig('prompt_relearning');

    const systemPrompt = `
      [ADN]: ${customPrompts?.prompt_adn_core || getConfig('prompt_adn_core')}
      [VENTA]: ${customPrompts?.prompt_estrategia_cierre || getConfig('prompt_estrategia_cierre')}
      
      === REGLAS DE CONDUCTA ANTI-ROBOT (PRIORIDAD MÁXIMA) ===
      1. MEMORIA DE SALUDOS: Lee el historial. Si ya saludaste, NO vuelvas a saludar.
      2. NO REPETIR INFORMACIÓN: Si ya enviaste los detalles del taller, ESTÁ PROHIBIDO volver a escribirlos.
      3. MEMORIA DE PAGOS (ESTRICTO): Si en el historial ya enviaste la cuenta, la CLABE o el link de pago, NUNCA LOS VUELVAS A REPETIR. Si preguntan "¿se puede en Oxxo?" diles: "Sí, puedes usar la misma cuenta de arriba".
      4. CONTEXTO CONTINUO: Compórtate como humano. Si responden tus preguntas, solo asiente de forma natural, NO repitas el mensaje de venta ni los datos.

      === ESCALADO A HUMANO (MUY IMPORTANTE) ===
      Si el cliente pide explícitamente hablar con una persona o hace preguntas que no puedes responder, DEBES:
      1. Responderle diciendo que en breve será atendido por un asesor.
      2. PAUSAR tu operación añadiendo este bloque JSON EXACTO al final de tu respuesta:
      ---JSON---
      {"request_human": true}

      ${pRelearning && pRelearning.trim() !== '' && pRelearning !== '# Aún no hay lecciones inyectadas.' ? `\n=== REGLAS #CIA (PRIORIDAD ABSOLUTA) ===\n${pRelearning}\n` : ''}

      ${masterTruth}
      
      ${kbContext}

      ${mediaContext}

      ${catalogContext}

      === DATOS DE TRANSFERENCIA DIRECTA ===
      Cuenta: ${bankInfo}
    `;

    const messages = [
        { role: "system", content: "Eres Sam. Al final añade '---JSON---' con layers_used y reasoning. Si te piden un humano, añade 'request_human': true." },
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
        explanation: parts[1] ? JSON.parse(parts[1].trim().replace(/```json/g, '').replace(/```/g, '')) : { layers_used: ["CATÁLOGO WOOCOMMERCE", "VERDAD MAESTRA"], reasoning: "Contexto cruzado correctamente." }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})