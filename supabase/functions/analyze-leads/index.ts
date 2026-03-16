// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { lead_id } = await req.json();

    // 1. Obtener datos del lead y configuración
    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const apiKey = configMap['openai_api_key'];

    // 2. Obtener Agentes para el Routing Inteligente
    const { data: agents } = await supabaseClient.from('profiles').select('id, full_name, territories').eq('is_active', true);
    const agentsList = agents?.map(a => `- Agente: ${a.full_name}, ID: ${a.id}, Territorios: ${a.territories?.join(', ') || 'Global'}`).join('\n');

    // 3. Obtener Historial
    const { data: messages } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead_id).order('created_at', { ascending: true }).limit(20);
    const transcript = messages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

    const systemPrompt = `
Eres el Analista Táctico de Samurai CRM. Tu misión es procesar el chat y actualizar el CRM.

=== TAREAS DE EXTRACCIÓN ===
1. DATOS: Nombre, Email, Ciudad.
2. PERFIL PSICOGRÁFICO: Identifica si es para uso PERSONAL (sanación, hobby) o PROFESIONAL (terapeuta, psicólogo). Resume sus miedos/deseos.
3. INTENT: BAJO, MEDIO, ALTO, COMPRADO.

=== LÓGICA DE ROUTING (ASIGNACIÓN) ===
Debes decidir quién es el mejor agente para atender a este cliente basándote en la CIUDAD detectada y esta lista:
${agentsList}

REGLA DE PROXIMIDAD: Si la ciudad no coincide exactamente (ej: Zapopan), usa tu conocimiento geográfico para asignarlo al agente de la zona más cercana (ej: Guadalajara). Si no hay cercanía obvia, asigna al agente 'Global' o deja en null.

RESPONDE SOLO JSON:
{
  "nombre": "string", "email": "string", "ciudad": "string",
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
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Chat:\n${transcript}` }],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // 4. Actualizar Lead
    const updates: any = { last_ai_analysis: new Date().toISOString() };
    if (result.nombre && result.nombre !== 'null') updates.nombre = result.nombre;
    if (result.email && result.email !== 'null') updates.email = result.email;
    if (result.ciudad && result.ciudad !== 'null') updates.ciudad = result.ciudad;
    if (result.intent) updates.buying_intent = result.intent;
    if (result.summary) updates.summary = result.summary;
    if (result.perfil_psicologico) updates.perfil_psicologico = result.perfil_psicologico;
    if (result.suggested_agent_id && !lead.assigned_to) updates.assigned_to = result.suggested_agent_id;

    await supabaseClient.from('leads').update(updates).eq('id', lead_id);

    // 5. DISPARO META CAPI (Si detectamos email por primera vez)
    if (result.email && result.email.includes('@') && !lead.capi_lead_event_sent_at) {
        console.log(`[Analista] Nuevo Email detectado (${result.email}). Disparando Meta CAPI...`);
        
        const eventPayload = {
            eventData: {
                event_name: 'Lead',
                lead_id: lead_id,
                user_data: {
                    em: result.email,
                    ph: lead.telefono,
                    fn: result.nombre || lead.nombre,
                    ct: result.ciudad || lead.ciudad
                }
            },
            config: {
                pixel_id: configMap['meta_pixel_id'],
                access_token: configMap['meta_access_token'],
                test_event_code: configMap['meta_test_event_code']
            }
        };

        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/meta-capi-sender`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
            body: JSON.stringify(eventPayload)
        }).catch(e => console.error("Error CAPI:", e));

        await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead_id);
    }

    return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})