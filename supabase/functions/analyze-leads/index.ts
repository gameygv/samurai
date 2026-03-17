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

    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    if (!lead) throw new Error("Lead no encontrado");

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const apiKey = configMap['openai_api_key'];

    const { data: agents } = await supabaseClient.from('profiles').select('id, full_name, territories').eq('is_active', true);
    const agentsContext = agents?.map(a => `- ID: ${a.id}, Nombre: ${a.full_name}, Zonas: ${a.territories?.join(', ') || 'GLOBAL'}`).join('\n');

    const { data: messagesData } = await supabaseClient
        .from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead_id)
        .order('created_at', { ascending: false })
        .limit(15);
        
    const transcript = (messagesData || []).reverse().map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n');

    const systemPrompt = `
Eres el Analista Maestro del CRM. Tu misión es extraer datos de identidad.
REGLA DE ORO: Si el usuario dice "Me llamo X" o "Soy X", extrae ese nombre y apellidos. 
ESTO DEBE SOBREESCRIBIR cualquier nombre provisional que tenga el sistema.

DATOS A BUSCAR:
1. NOMBRE: Nombre real de la persona.
2. CIUDAD: Ciudad, Estado o Municipio de México.
3. EMAIL: Correos electrónicos.

ROUTING:
Asigna al agente cuya zona coincida con la ciudad:
${agentsContext}

RESPONDE SOLO JSON:
{
  "nombre": "Pedro Torres", 
  "email": "pedro@ejemplo.com", 
  "ciudad": "Guanajuato",
  "intent": "BAJO|MEDIO|ALTO|COMPRADO",
  "perfil_psicologico": "Breve descripción",
  "suggested_agent_id": "UUID"
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

    const updates: any = { last_ai_analysis: new Date().toISOString() };
    
    // Solo actualizar si el dato es real y nuevo
    if (result.nombre && result.nombre !== 'null') updates.nombre = result.nombre;
    if (result.email && result.email !== 'null') updates.email = result.email;
    if (result.ciudad && result.ciudad !== 'null') updates.ciudad = result.ciudad;
    if (result.intent) updates.buying_intent = result.intent;
    if (result.perfil_psicologico) updates.perfil_psicologico = result.perfil_psicologico;
    
    // Routing Manual de Seguridad
    let finalAgentId = result.suggested_agent_id;
    if (!finalAgentId && updates.ciudad && !lead.assigned_to) {
        const cityNorm = updates.ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const agent of agents) {
            const match = agent.territories?.some(t => cityNorm.includes(t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
            if (match) { finalAgentId = agent.id; break; }
        }
    }

    if (finalAgentId && !lead.assigned_to) updates.assigned_to = finalAgentId;

    await supabaseClient.from('leads').update(updates).eq('id', lead_id);

    // Disparo Meta CAPI
    if ((updates.email || updates.ciudad) && !lead.capi_lead_event_sent_at) {
        await supabaseClient.functions.invoke('meta-capi-sender', {
            body: {
                eventData: {
                    event_name: 'Lead', lead_id,
                    user_data: { em: updates.email || lead.email, ph: lead.telefono, fn: updates.nombre || lead.nombre, ct: updates.ciudad || lead.ciudad }
                },
                config: { pixel_id: configMap['meta_pixel_id'], access_token: configMap['meta_access_token'] }
            }
        });
        await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead_id);
    }

    console.log(`[analyze-leads] Proceso finalizado para ${lead_id}. Datos extraídos: ${JSON.stringify(updates)}`);
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})