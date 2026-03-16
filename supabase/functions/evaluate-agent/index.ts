// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    
    const { agent_id, lead_id, message_text } = await req.json();

    if (!agent_id || !message_text || message_text.length < 5) {
        return new Response(JSON.stringify({ ignored: true, reason: 'Mensaje muy corto o sin agente' }), { headers: corsHeaders });
    }

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find((c: any) => c.key === key)?.value || "";
    
    const apiKey = getConfig('openai_api_key');
    if (!apiKey) throw new Error("OpenAI API Key no encontrada.");

    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;
    const productsStr = getConfig('wc_products') || '[]';

    const pQaAuditor = getConfig('prompt_qa_auditor', `
Eres el Auditor de Calidad (QA). Evalúa este mensaje enviado por un VENDEDOR HUMANO a un cliente.
Reglas:
1. SCORE (0-100): Evalúa ortografía y persuasión.
2. TONE_ANALYSIS: Describe en 5 palabras el tono.
3. ANOMALY_DETECTED (CRÍTICO): PON TRUE SI da cuenta bancaria o precios falsos, o es grosero. Si no, false.
4. ANOMALY_DETAILS: Explica la anomalía si existe, si no, null.
Responde ÚNICAMENTE con JSON: {"score": 85, "tone_analysis": "Amable", "anomaly_detected": false, "anomaly_details": null}
    `);

    const auditPrompt = `
=== DATOS OFICIALES DE LA EMPRESA (VERDAD ABSOLUTA) ===
Datos Bancarios Oficiales:
${bankInfo}

Catálogo de Productos y Precios:
${productsStr}

=== INSTRUCCIONES DE AUDITORÍA ===
${pQaAuditor}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          model: "gpt-4o", 
          messages: [
              { role: "system", content: auditPrompt },
              { role: "user", content: `Mensaje del vendedor: "${message_text}"` }
          ], 
          response_format: { type: "json_object" },
          temperature: 0.1 
      })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    await supabaseClient.from('agent_evaluations').insert({
        agent_id, lead_id, message_text,
        score: result.score, tone_analysis: result.tone_analysis,
        anomaly_detected: result.anomaly_detected, anomaly_details: result.anomaly_details
    });

    if (result.anomaly_detected) {
        await supabaseClient.from('activity_logs').insert({
            action: 'ERROR', resource: 'USERS', description: `🚨 ALERTA QA (Vendedor): ${result.anomaly_details}`, status: 'ERROR'
        });
    }

    return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})