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

    const { data: agents } = await supabaseClient.from('profiles').select('id, full_name, territories').eq('is_active', true);
    const agentsContext = agents?.map(a => `- Agente ID: ${a.id}, Nombre: ${a.full_name}, Cobertura: ${a.territories?.join(', ') || 'GLOBAL'}`).join('\n');

    const { data: messages } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead_id).order('created_at', { ascending: true }).limit(25);
    const transcript = messages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

    const systemPrompt = `
Eres el Analista de Datos de Inteligencia del CRM. Tu única misión es extraer datos críticos del chat.

=== EXTRACCIÓN CRÍTICA ===
1. NOMBRE: Si el cliente dice "Soy Pedro", "Me llamo Laura", extrae el nombre.
2. CIUDAD: Si menciona una ciudad, estado, país o municipio, extraelo.
3. EMAIL: Busca correos electrónicos.
CRÍTICO: Si no encuentras un dato, debes devolver exactamente null (no uses "N/A", "Desconocido", ni "No especificado").

=== REGLAS DE ROUTING (GEOPROXIMIDAD) ===
Asigna un responsable basado en la CIUDAD extraída:
${agentsContext}
Si la ciudad del cliente coincide con la zona de un agente, devuelve su ID en 'suggested_agent_id'.

RESPONDE SOLO EN ESTE FORMATO JSON:
{
  "nombre": "string o null", 
  "email": "string o null", 
  "ciudad": "string o null",
  "intent": "BAJO|MEDIO|ALTO|COMPRADO",
  "perfil_psicologico": "Resumen de su necesidad (Max 15 palabras)",
  "suggested_agent_id": "UUID del agente o null"
}
`;

    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Chat:\n\n${transcript}` }],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    const updates: any = { last_ai_analysis: new Date().toISOString() };
    
    // Asignación segura de variables
    if (result.nombre && result.nombre !== 'null' && result.nombre !== null) updates.nombre = result.nombre;
    if (result.email && result.email !== 'null' && result.email !== null) updates.email = result.email;
    if (result.ciudad && result.ciudad !== 'null' && result.ciudad !== null) updates.ciudad = result.ciudad;
    if (result.intent) updates.buying_intent = result.intent;
    if (result.perfil_psicologico) updates.perfil_psicologico = result.perfil_psicologico;
    
    // BLINDAJE: Verificación de Integridad Referencial
    if (result.suggested_agent_id && result.suggested_agent_id !== 'null' && result.suggested_agent_id !== null && !lead.assigned_to) {
        // Confirmar que el ID que inventó la IA realmente existe en la BD
        if (agents.some(a => a.id === result.suggested_agent_id)) {
            updates.assigned_to = result.suggested_agent_id;
            await supabaseClient.from('activity_logs').insert({
                action: 'UPDATE', resource: 'USERS', 
                description: `Routing IA: Lead asignado a agente por proximidad en '${result.ciudad}'.`,
                status: 'OK'
            });
        }
    }

    await supabaseClient.from('leads').update(updates).eq('id', lead_id);

    // Disparar CAPI (await para asegurar que no se mate el hilo)
    const hasMeaningfulData = (result.email && result.email !== 'null' && result.email !== null) || 
                              (result.ciudad && result.ciudad !== 'null' && result.ciudad !== null) || 
                              (result.nombre && result.nombre !== 'null' && result.nombre !== null && !result.nombre.includes('Cliente WA') && !result.nombre.includes('Lead Gowa'));

    if (hasMeaningfulData && !lead.capi_lead_event_sent_at) {
        await supabaseClient.functions.invoke('meta-capi-sender', {
            body: {
                eventData: {
                    event_name: 'Lead', lead_id,
                    user_data: { em: result.email, ph: lead.telefono, fn: result.nombre || lead.nombre, ct: result.ciudad || lead.ciudad }
                },
                config: { pixel_id: configMap['meta_pixel_id'], access_token: configMap['meta_access_token'] }
            }
        });
        await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead_id);
    }

    return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})