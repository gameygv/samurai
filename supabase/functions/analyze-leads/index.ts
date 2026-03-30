// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { lead_id, force } = await req.json();

    let leadsToProcess = [];
    if (lead_id) {
       const { data: l } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
       if (l) leadsToProcess = [l];
    } else {
       const { data: batch } = await supabaseClient.from('leads')
          .select('*')
          .or('email.is.null,ciudad.is.null,assigned_to.is.null')
          .order('last_ai_analysis', { ascending: true, nullsFirst: true })
          .limit(5);
       if (batch) leadsToProcess = batch;
    }

    if (leadsToProcess.length === 0) {
       return new Response(JSON.stringify({ message: "No leads pending analysis." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const apiKey = configMap['openai_api_key'];

    for (const lead of leadsToProcess) {
        if (!force && (lead.buying_intent === 'COMPRADO' || lead.buying_intent === 'PERDIDO')) continue;

        const { data: messagesData } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false })
            .limit(20);
            
        const transcript = (messagesData || []).reverse().map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n');

        const systemPrompt = `
Eres el Auditor de Identidad del CRM. Tu misión es extraer datos reales de la conversación.
REGLA DE ORO: NUNCA sugieras 'PERDIDO' a menos que el cliente explícitamente diga que NO le interesa o te insulte. 
Si solo dice "hola" o está conociendo el negocio, mantén el intent en 'BAJO'.

RESPONDE SOLO JSON: {
  "nombre": "...", "email": "...", "ciudad": "...", "estado": "...", "cp": "...", 
  "intent": "BAJO|MEDIO|ALTO", "perfil": "...", "summary": "..."
}`;

        const aiRes = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Chat:\n${transcript}` }],
                response_format: { type: "json_object" },
                temperature: 0
            })
        });

        const aiData = await aiRes.json();
        const result = JSON.parse(aiData.choices[0].message.content);

        const updates: any = { last_ai_analysis: new Date().toISOString() };
        if (result.nombre && result.nombre !== 'null') updates.nombre = result.nombre;
        if (result.email && result.email !== 'null') updates.email = result.email;
        if (result.ciudad && result.ciudad !== 'null') updates.ciudad = result.ciudad;
        if (result.estado && result.estado !== 'null') updates.estado = result.estado;
        if (result.cp && result.cp !== 'null') updates.cp = String(result.cp);
        
        // Solo subimos la intención si es mayor a la actual y no es PERDIDO/COMPRADO manual
        const intentLevels = { 'BAJO': 1, 'MEDIO': 2, 'ALTO': 3 };
        if (lead.buying_intent !== 'COMPRADO' && lead.buying_intent !== 'PERDIDO') {
            const currentLvl = intentLevels[lead.buying_intent] || 1;
            const newLvl = intentLevels[result.intent] || 1;
            if (newLvl > currentLvl) updates.buying_intent = result.intent;
        }

        if (result.perfil) updates.perfil_psicologico = result.perfil;
        if (result.summary) updates.summary = result.summary;
        
        await supabaseClient.from('leads').update(updates).eq('id', lead.id);
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})