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

    const { data: agents } = await supabaseClient.from('profiles').select('id, full_name, territories').eq('is_active', true);
    const agentsContext = agents?.map(a => `- ID: ${a.id}, Nombre: ${a.full_name}, Zonas: ${a.territories?.join(', ') || 'GLOBAL'}`).join('\n');

    const results = [];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    for (const lead of leadsToProcess) {
        // No analizar leads que ya estén ganados o perdidos a menos que se fuerce
        if (!force && (lead.buying_intent === 'COMPRADO' || lead.buying_intent === 'PERDIDO')) {
           continue;
        }

        const { data: messagesData } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false })
            .limit(20);
            
        const transcript = (messagesData || []).reverse().map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n');

        const systemPrompt = `
Eres el Auditor de Identidad del CRM. Tu misión es extraer datos reales de la conversación.
REGLA DE ORO: Si el usuario dice "Soy X" o "Mi nombre es X", ese es su NOMBRE REAL.
IMPORTANTE SOBRE INTENCIÓN DE COMPRA: NUNCA ASIGNES 'COMPRADO'. Solo elige entre BAJO, MEDIO, ALTO o PERDIDO.

DATOS A EXTRAER:
1. NOMBRE: Nombre real.
2. CIUDAD: Ciudad/Estado en México.
3. EMAIL: Correos.
4. PERFIL: Perfil psicológico o dolores principales.
5. SUMMARY: Un resumen MUY CORTO de la situación actual (Máximo 15 palabras).
ROUTING: Elige EXACTAMENTE el ID del agente según la ciudad:
${agentsContext}

RESPONDE SOLO JSON: {"nombre": "...", "email": "...", "ciudad": "...", "intent": "BAJO|MEDIO|ALTO|PERDIDO", "perfil": "...", "summary": "...", "suggested_agent_id": "UUID"}`;

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
        
        // Bloqueo de seguridad: Evitar falso COMPRADO
        if (result.intent && result.intent !== 'COMPRADO') {
            updates.buying_intent = result.intent;
        }

        if (result.perfil) updates.perfil_psicologico = result.perfil;
        if (result.summary) updates.summary = result.summary;
        
        if (!lead.assigned_to) {
            let finalAgentId = result.suggested_agent_id;
            if (!uuidRegex.test(finalAgentId) && updates.ciudad) {
                const cityNorm = updates.ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const match = agents.find(a => a.territories?.some(t => cityNorm.includes(t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))));
                if (match) finalAgentId = match.id;
            }
            if (uuidRegex.test(finalAgentId)) {
                updates.assigned_to = finalAgentId;
            }
        }

        await supabaseClient.from('leads').update(updates).eq('id', lead.id);
        
        if ((updates.email || updates.ciudad) && !lead.capi_lead_event_sent_at) {
             try {
                 await supabaseClient.functions.invoke('meta-capi-sender', {
                    body: {
                        eventData: { 
                           event_name: 'Lead', 
                           lead_id: lead.id, 
                           user_data: { em: updates.email || lead.email, ph: lead.telefono, fn: updates.nombre || lead.nombre, ct: updates.ciudad || lead.ciudad },
                           custom_data: { 
                              perfil_psicologico: updates.perfil_psicologico || lead.perfil_psicologico || 'Perfil en evaluación por IA',
                              intencion_compra: updates.buying_intent || lead.buying_intent || 'BAJO'
                           }
                        },
                        config: { pixel_id: configMap['meta_pixel_id'], access_token: configMap['meta_access_token'] }
                    }
                 });
                 await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead.id);
             } catch (capiError) {
                 console.error("Fallo silencioso CAPI:", capiError);
             }
        }
        results.push({ id: lead.id, updates });
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})