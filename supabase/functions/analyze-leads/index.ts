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

    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const apiKey = configMap['openai_api_key'];

    // Obtener agentes y sus territorios para el Routing
    const { data: agents } = await supabaseClient.from('profiles').select('id, full_name, territories').in('role', ['admin', 'dev', 'sales']);
    const agentsContext = agents?.map(a => `ID: ${a.id}, Nombre: ${a.full_name}, Zonas: ${a.territories?.join(', ') || 'Global'}`).join('\n');

    const { data: messages } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead_id).order('created_at', { ascending: true }).limit(25);
    const transcript = messages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

    const systemPrompt = `
Eres el Analista Táctico de Samurai CRM. Tu misión es extraer datos y tomar decisiones de asignación.

=== REGLAS DE EXTRACCIÓN ===
1. NOMBRE/APELLIDO: Extrae nombres reales.
2. CIUDAD: Ubicación actual.
3. PERFIL PSICOGRÁFICO: Resume en 20 palabras sus miedos, deseos y por qué le interesan los cuencos.
4. INTENT: BAJO, MEDIO, ALTO, COMPRADO.

=== REGLAS DE ASIGNACIÓN (ROUTING) ===
Compara la CIUDAD del cliente con esta lista de agentes y sus zonas:
${agentsContext}

Si la ciudad coincide con una zona, asigna ese ID. 
Si NO hay coincidencia exacta, usa tu conocimiento geográfico para asignar al agente de la zona más cercana o al que tenga 'Global'.

RESPONDE SOLO JSON:
{
  "nombre": "string", "apellido": "string", "ciudad": "string",
  "intent": "string", "summary": "string",
  "perfil_psicologico": "string",
  "suggested_agent_id": "uuid o null"
}
`;

    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Analiza este chat:\n\n${transcript}` }],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    const updates: any = { last_ai_analysis: new Date().toISOString() };
    if (result.nombre) updates.nombre = result.nombre;
    if (result.apellido) updates.apellido = result.apellido;
    if (result.ciudad) updates.ciudad = result.ciudad;
    if (result.intent) updates.buying_intent = result.intent;
    if (result.summary) updates.summary = result.summary;
    if (result.perfil_psicologico) updates.perfil_psicologico = result.perfil_psicologico;
    if (result.suggested_agent_id && !lead.assigned_to) updates.assigned_to = result.suggested_agent_id;

    await supabaseClient.from('leads').update(updates).eq('id', lead_id);

    // --- DISPARO META CAPI (Si hay email nuevo) ---
    if (updates.email && !lead.capi_lead_event_sent_at) {
        console.log("[analyze-leads] Disparando Meta CAPI Lead Event...");
        // Aquí llamamos a la función de CAPI que ya tenemos
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/meta-capi-sender`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
            body: JSON.stringify({
                eventData: {
                    event_name: 'Lead',
                    lead_id: lead_id,
                    user_data: { em: updates.email, ph: lead.telefono, fn: updates.nombre, ct: updates.ciudad }
                },
                config: { 
                    pixel_id: configMap['meta_pixel_id'], 
                    access_token: configMap['meta_access_token'],
                    test_event_code: configMap['meta_test_event_code']
                }
            })
        }).catch(e => console.error("CAPI Error:", e));
        
        await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead_id);
    }

    return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})