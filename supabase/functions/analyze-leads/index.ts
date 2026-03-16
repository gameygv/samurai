// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { lead_id, force } = await req.json();
    if (!lead_id) throw new Error("Lead ID requerido.");

    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const apiKey = configMap['openai_api_key'];
    let extractionPrompt = configMap['prompt_analista_datos'] || 'Extrae datos en JSON...';

    if (!apiKey) throw new Error("OpenAI API Key faltante.");

    const { data: agents } = await supabaseClient
        .from('profiles')
        .select('id, full_name, territories')
        .in('role', ['sales', 'agent', 'admin'])
        .not('territories', 'is', null);

    if (agents && agents.length > 0 && !lead.assigned_to) {
        extractionPrompt += `\n\n=== ASIGNACIÓN GEOGRÁFICA DE LEADS ===
Agentes disponibles y sus zonas:
${agents.map(a => `- ID: ${a.id} | Nombre: ${a.full_name} | Zonas: ${(a.territories || []).join(', ')}`).join('\n')}

REGLA DE ASIGNACIÓN:
Analiza la ciudad, estado o país del lead en la conversación. Busca qué agente cubre esa zona. 
- Si ningún agente la cubre exactamente, usa lógica geográfica estricta para encontrar al agente con la zona más cercana (Ej: Si el lead es de Irapuato y nadie lo cubre, pero alguien tiene Guadalajara, asígnalo a él).
- Si hay varios agentes empatados en zona o cercanía, devuelve los IDs de todos ellos.
- Si el lead no dice su ubicación, devuelve un array vacío [].
Debes agregar obligatoriamente al JSON principal el campo "assigned_agent_ids": ["id1", "id2"]`;
    }

    const { data: messages } = await supabaseClient
        .from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead_id)
        .order('created_at', { ascending: true }) 
        .limit(50);

    const transcript = messages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: extractionPrompt },
                { role: "user", content: `Analiza este chat y devuelve el JSON:\n\n${transcript}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    const updates: any = { 
        last_ai_analysis: new Date().toISOString(),
        perfil_psicologico: `MOTIVACIÓN: ${result.main_pain || 'N/A'}. PERFIL: ${result.psych_profile || 'N/A'}`
    };
    
    // --- SANITIZACIÓN ESTRICTA ---
    if (result.nombre && result.nombre !== 'null') updates.nombre = result.nombre;
    if (result.apellido && result.apellido !== 'null') updates.apellido = result.apellido;
    if (result.ciudad && result.ciudad !== 'null') updates.ciudad = result.ciudad;
    if (result.estado && result.estado !== 'null') updates.estado = result.estado;
    if (result.cp && result.cp !== 'null') updates.cp = result.cp;
    if (result.pais && result.pais !== 'null') updates.pais = result.pais;
    if (result.intent && result.intent !== 'null') updates.buying_intent = result.intent;
    if (result.summary && result.summary !== 'null') updates.summary = result.summary;
    if (result.origen_contacto && result.origen_contacto !== 'null') updates.origen_contacto = result.origen_contacto;
    if (result.servicio_interes && result.servicio_interes !== 'null') updates.servicio_interes = result.servicio_interes;
    if (result.tiempo_compra && result.tiempo_compra !== 'null') updates.tiempo_compra = result.tiempo_compra;
    if (result.main_pain && result.main_pain !== 'null') updates.main_pain = result.main_pain;
    if (result.lead_score) updates.lead_score = parseInt(result.lead_score) || 0;

    // Validación Anti-Basura para Emails
    if (result.email && result.email !== 'null') {
        const cleanEmail = result.email.trim().toLowerCase();
        // Solo aceptamos emails que tengan formato válido para no ensuciar Meta CAPI
        if (cleanEmail.includes('@') && cleanEmail.includes('.') && cleanEmail.length > 5 && !cleanEmail.includes('no') && !cleanEmail.includes('nada')) {
            updates.email = cleanEmail;
        }
    }

    if (!lead.assigned_to && result.assigned_agent_ids && Array.isArray(result.assigned_agent_ids) && result.assigned_agent_ids.length > 0) {
        const randomIndex = Math.floor(Math.random() * result.assigned_agent_ids.length);
        updates.assigned_to = result.assigned_agent_ids[randomIndex];
    }

    const { data: updatedLead } = await supabaseClient.from('leads').update(updates).eq('id', lead_id).select().single();

    // ============================================================================
    // AUTO-DISPARADOR META CAPI (EVENTO: LEAD)
    // ============================================================================
    // Nos aseguramos nuevamente de que el email sea válido y no alucinado antes de disparar CAPI
    if (updatedLead.email && updatedLead.email.includes('@') && updatedLead.nombre && !updatedLead.capi_lead_event_sent_at && configMap['meta_pixel_id'] && configMap['meta_access_token']) {
        
        const eventData = {
            event_name: 'Lead',
            lead_id: updatedLead.id,
            user_data: {
                em: updatedLead.email,
                ph: updatedLead.telefono,
                fn: updatedLead.nombre,
                ln: updatedLead.apellido,
                ct: updatedLead.ciudad,
                st: updatedLead.estado,
                zp: updatedLead.cp,
                country: updatedLead.pais || 'mx',
                external_id: updatedLead.id
            },
            custom_data: {
                intention: updatedLead.buying_intent,
                content_name: updatedLead.servicio_interes,
                lead_source: updatedLead.origen_contacto,
                main_pain: updatedLead.main_pain,
                time_to_buy: updatedLead.tiempo_compra,
                lead_score: updatedLead.lead_score
            }
        };

        const capiRes = await supabaseClient.functions.invoke('meta-capi-sender', {
            body: { 
                eventData, 
                config: { 
                    pixel_id: configMap['meta_pixel_id'], 
                    access_token: configMap['meta_access_token'],
                    test_mode: configMap['meta_test_mode'] === 'true',
                    test_event_code: configMap['meta_test_event_code']
                } 
            }
        });

        if (capiRes.data?.success) {
            await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead_id);
        }
    }

    return new Response(JSON.stringify({ success: true, lead: updatedLead }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})