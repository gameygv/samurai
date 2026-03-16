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
Eres el Analista de Datos de The Elephant Bowl. Tu misión es extraer inteligencia y asignar responsables.

=== REGLAS DE ROUTING (GEOPROXIMIDAD) ===
Tu tarea es decidir quién atiende este lead basándote en su CIUDAD. 
Lista de Agentes y Zonas:
${agentsContext}

INSTRUCCIÓN DE GPS IA: 
1. Si el cliente dice "Zapopan" y un agente tiene "Guadalajara" o "Jalisco", ASÍGNALO A ÉL.
2. Si la ciudad es pequeña, busca la ciudad grande más cercana (ej: San Pedro -> Monterrey).
3. Si no hay una relación geográfica clara, asígnalo al agente que tenga cobertura 'GLOBAL' o deja en null.

=== PERFILAMIENTO PSICOGRÁFICO ===
Extrae por qué le interesa el curso: ¿Manejo de estrés? ¿Es terapeuta (profesional)? ¿Busca una experiencia mística? Resume en 15 palabras.

RESPONDE SOLO JSON:
{
  "nombre": "string", "email": "string", "ciudad": "string",
  "intent": "BAJO|MEDIO|ALTO|COMPRADO",
  "perfil_psicologico": "string",
  "suggested_agent_id": "UUID o null"
}
`;

    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Chat del Lead:\n\n${transcript}` }],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    const updates: any = { last_ai_analysis: new Date().toISOString() };
    if (result.nombre && result.nombre !== 'null') updates.nombre = result.nombre;
    if (result.email && result.email !== 'null') updates.email = result.email;
    if (result.ciudad && result.ciudad !== 'null') updates.ciudad = result.ciudad;
    if (result.intent) updates.buying_intent = result.intent;
    if (result.perfil_psicologico) updates.perfil_psicologico = result.perfil_psicologico;
    
    if (result.suggested_agent_id && !lead.assigned_to) {
        updates.assigned_to = result.suggested_agent_id;
        await supabaseClient.from('activity_logs').insert({
            action: 'UPDATE', resource: 'USERS', 
            description: `Routing IA: Lead asignado a agente por proximidad en '${result.ciudad}'.`,
            status: 'OK'
        });
    }

    await supabaseClient.from('leads').update(updates).eq('id', lead_id);

    if (result.email && !lead.capi_lead_event_sent_at) {
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/meta-capi-sender`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
            body: JSON.stringify({
                eventData: {
                    event_name: 'Lead', lead_id,
                    user_data: { em: result.email, ph: lead.telefono, fn: result.nombre || lead.nombre, ct: result.ciudad || lead.ciudad }
                },
                config: { 
                    pixel_id: configMap['meta_pixel_id'], 
                    access_token: configMap['meta_access_token'] 
                }
            })
        }).catch(() => {});
        await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead_id);
    }

    return new Response(JSON.stringify({ success: true, result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})