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
    if (!lead) throw new Error("Lead no encontrado");

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const apiKey = configMap['openai_api_key'];

    const { data: agents } = await supabaseClient.from('profiles').select('id, full_name, territories').eq('is_active', true);
    const agentsContext = agents?.map(a => `- Agente ID: ${a.id}, Nombre: ${a.full_name}, Cobertura: ${a.territories?.join(', ') || 'GLOBAL'}`).join('\n');

    // FIX: Obtener los últimos 20 mensajes correctamente (descendente y luego revertir)
    const { data: messagesData } = await supabaseClient
        .from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead_id)
        .order('created_at', { ascending: false })
        .limit(20);
        
    const transcript = (messagesData || []).reverse().map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n');

    const systemPrompt = `
Eres el Analista de Datos de Inteligencia del CRM. Tu única misión es extraer datos críticos del chat.
Lee TODO el contexto, prestando especial atención a los textos marcados como [TRANSCRIPCIÓN DE NOTA DE VOZ].

=== EXTRACCIÓN CRÍTICA ===
1. NOMBRE: Extrae el nombre real de la persona si se presenta (ej: "Soy Pedro", "Me llamo Laura"). IGNORA nombres de sistema o apodos raros si la persona dice su nombre real.
2. CIUDAD: Si menciona una ciudad, estado, país o municipio (ej: "Guanajuato", "León"), extráelo.
3. EMAIL: Busca correos electrónicos.
CRÍTICO: Si no encuentras un dato explícito en la conversación, debes devolver exactamente null (no uses "N/A", "Desconocido").

=== REGLAS DE ROUTING (GEOPROXIMIDAD) ===
Asigna un responsable basado en la CIUDAD extraída analizando esta lista de agentes:
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
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Chat Reciente:\n\n${transcript}` }],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    const updates: any = { last_ai_analysis: new Date().toISOString() };
    
    // Asignación segura
    if (result.nombre && result.nombre !== 'null' && result.nombre !== null) updates.nombre = result.nombre;
    if (result.email && result.email !== 'null' && result.email !== null) updates.email = result.email;
    if (result.ciudad && result.ciudad !== 'null' && result.ciudad !== null) updates.ciudad = result.ciudad;
    if (result.intent) updates.buying_intent = result.intent;
    if (result.perfil_psicologico) updates.perfil_psicologico = result.perfil_psicologico;
    
    // --- FALLBACK JS: ROUTING DE AGENTES ---
    // Si la IA no mapeó el UUID pero sí extrajo la ciudad, hacemos el match manualmente
    let finalAgentId = result.suggested_agent_id;
    if ((!finalAgentId || finalAgentId === 'null') && updates.ciudad && !lead.assigned_to) {
        const cityNorm = updates.ciudad.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const agent of agents) {
            if (!agent.territories) continue;
            const match = agent.territories.some(t => {
                const tNorm = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return cityNorm.includes(tNorm) || tNorm.includes(cityNorm);
            });
            if (match) { finalAgentId = agent.id; break; }
        }
    }

    if (finalAgentId && finalAgentId !== 'null' && finalAgentId !== null && !lead.assigned_to) {
        if (agents.some(a => a.id === finalAgentId)) {
            updates.assigned_to = finalAgentId;
            await supabaseClient.from('activity_logs').insert({
                action: 'UPDATE', resource: 'USERS', 
                description: `Routing IA: Lead asignado por proximidad en '${updates.ciudad}'.`,
                status: 'OK'
            });
        }
    }

    await supabaseClient.from('leads').update(updates).eq('id', lead_id);

    // --- DISPARAR META CAPI ---
    const hasMeaningfulData = (updates.email) || (updates.ciudad) || (updates.nombre && updates.nombre !== lead.nombre && !updates.nombre.includes('Cliente'));

    if (hasMeaningfulData && !lead.capi_lead_event_sent_at) {
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

    return new Response(JSON.stringify({ success: true, result: updates }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})