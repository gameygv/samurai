// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { lead_id } = await req.json();

    // 1. Obtener datos actuales
    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    const { data: agents } = await supabaseClient.from('profiles').select('id, full_name, territories').in('role', ['sales', 'admin', 'dev']);
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});

    const { data: messages } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead_id).order('created_at', { ascending: true }).limit(20);
    const transcript = messages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

    // 2. IA extrae datos y decide Asignación
    const systemPrompt = `
Eres el Analista Maestro y Selector de Tráfico.
TRANSCIPCIÓN RECIENTE:
${transcript}

LISTA DE AGENTES DISPONIBLES Y SUS TERRITORIOS:
${JSON.stringify(agents)}

INSTRUCCIONES:
1. Extrae: nombre, apellido, ciudad, email.
2. ASIGNACIÓN: Busca qué agente tiene la "ciudad" extraída en sus "territories".
3. Si no hay coincidencia exacta, elige al agente cuyo territorio sea geográficamente más cercano o compatible con la ciudad detectada.
4. Responde SOLO en JSON.

{
  "nombre": "string",
  "apellido": "string",
  "ciudad": "string",
  "email": "string",
  "assigned_to": "UUID del agente elegido",
  "summary": "Resumen de 10 palabras"
}
`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${configMap['openai_api_key']}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "system", content: systemPrompt }],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    const aiData = await aiRes.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // 3. Actualizar Lead y Disparar Meta CAPI si hay Email nuevo
    const updates: any = { 
        last_ai_analysis: new Date().toISOString(),
        nombre: result.nombre || lead.nombre,
        apellido: result.apellido || lead.apellido,
        ciudad: result.ciudad || lead.ciudad,
        email: result.email || lead.email,
        summary: result.summary || lead.summary,
        assigned_to: result.assigned_to || lead.assigned_to
    };

    const { error: updateError } = await supabaseClient.from('leads').update(updates).eq('id', lead_id);
    if (updateError) throw updateError;

    // --- GATILLO META CAPI (Solo si se capturó email por primera vez) ---
    if (result.email && !lead.capi_lead_event_sent_at) {
        console.log(`[analyze-leads] Disparando evento Lead a CAPI para ${result.email}`);
        
        const eventData = {
            event_name: 'Lead',
            lead_id: lead_id,
            user_data: {
                em: result.email,
                ph: lead.telefono,
                fn: result.nombre,
                ct: result.ciudad,
                country: 'mx'
            },
            custom_data: { source: 'auto_analysis_trigger' }
        };

        await supabaseClient.functions.invoke('meta-capi-sender', {
            body: { 
                eventData, 
                config: { 
                    pixel_id: configMap['meta_pixel_id'], 
                    access_token: configMap['meta_access_token'] 
                } 
            }
        });

        await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead_id);
    }

    return new Response(JSON.stringify({ success: true, routing: result.assigned_to }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})