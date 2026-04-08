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

    // CARGAR TODO EL CONTEXTO PARA UNA SIMULACIÓN REAL
    const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    let masterTruth = "\n=== VERDAD MAESTRA (SITIO WEB) ===\n";
    webPages?.forEach(p => { if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 1500)}\n`; });

    const { data: kbDocs } = await supabaseClient.from('knowledge_documents').select('title, category, content');
    let kbContext = "\n=== CONOCIMIENTO TÉCNICO (PDFs/NOTAS) ===\n";
    kbDocs?.forEach(d => { if(d.content) kbContext += `\n[RECURSO: ${d.title}]\n${d.content.substring(0, 1000)}\n`; });

    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions').neq('category', 'PAYMENT');
    let mediaContext = "\n=== BÓVEDA VISUAL (POSTERS) ===\nUsa <<MEDIA:URL>> para enviar posters.\n";
    mediaAssets?.forEach(m => { mediaContext += `- ${m.title}: ${m.ai_instructions} -> <<MEDIA:${m.url}>>\n`; });

    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;

    const systemPrompt = `
      ${customPrompts?.prompt_alma_samurai || getConfig('prompt_alma_samurai')}
      ${customPrompts?.prompt_adn_core || getConfig('prompt_adn_core')}
      ${customPrompts?.prompt_estrategia_cierre || getConfig('prompt_estrategia_cierre')}
      
      ${getConfig('prompt_behavior_rules')}
      ${getConfig('prompt_human_handoff')}

      ${masterTruth}
      ${kbContext}
      ${mediaContext}

      === DATOS DE PAGO ===
      ${bankInfo}
    `;

    const messages = [
        { role: "system", content: "Eres Sam. Al final de tu respuesta añade '---JSON---' con un objeto que tenga 'layers_used' (array de strings) y 'reasoning' (explicación de tu lógica)." },
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

    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${await response.text()}`);
    const aiData = await response.json();
    const rawText = aiData.choices?.[0]?.message?.content || '';
    const parts = rawText.split('---JSON---');
    
    let explanation = { layers_used: ["ADN CORE"], reasoning: "Respuesta generada por personalidad base." };
    if (parts[1]) {
      try { explanation = JSON.parse(parts[1].trim().replace(/```json/g, '').replace(/```/g, '')); } catch (_) {}
    }
    return new Response(JSON.stringify({
        answer: parts[0].trim(),
        explanation
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})