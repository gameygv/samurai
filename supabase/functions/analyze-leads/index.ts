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

    // 1. Obtener datos actuales y Configuración Global
    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    
    // Mapeo rápido de configs
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {});
    const apiKey = configMap['openai_api_key'];

    if (!apiKey) throw new Error("OpenAI API Key faltante.");

    // 2. Obtener Historial de Chat
    const { data: messages } = await supabaseClient
        .from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead_id)
        .order('created_at', { ascending: true }) 
        .limit(50);

    const transcript = messages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

    // 3. IA Extrae Datos Profundos
    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { 
                  role: "system", 
                  content: "Analista de Ventas. Extrae JSON: {email, ciudad, nombre, intent (ALTO/MEDIO/BAJO), summary, psych_profile, motivation, main_objection}. Si no hay email/ciudad nuevos, manten null." 
                },
                { role: "user", content: `Datos actuales: {nombre: "${lead.nombre}", ciudad: "${lead.ciudad}"}.\nAnaliza el chat:\n${transcript}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // 4. Actualizar Lead en Base de Datos
    // Solo actualizamos si hay datos nuevos y válidos
    const updates: any = { last_ai_analysis: new Date().toISOString() };
    
    if (result.nombre && result.nombre !== 'Desconocido') updates.nombre = result.nombre;
    if (result.email && result.email.includes('@')) updates.email = result.email;
    if (result.ciudad) updates.ciudad = result.ciudad;
    if (result.intent) updates.buying_intent = result.intent;
    if (result.summary) updates.summary = result.summary;
    if (result.psych_profile) updates.perfil_psicologico = `MOTIVACIÓN: ${result.motivation || 'N/A'}. OBJ: ${result.main_objection || 'N/A'}. PERFIL: ${result.psych_profile}`;

    const { data: updatedLead, error: updateError } = await supabaseClient
        .from('leads')
        .update(updates)
        .eq('id', lead_id)
        .select()
        .single();

    if (updateError) throw updateError;

    // 5. DETECCIÓN DE EVENTOS META CAPI (¡MAGIA!)
    // Disparamos si: Conseguimos Email o Ciudad nuevos.
    const gotNewEmail = !lead.email && updates.email;
    const gotNewCity = !lead.ciudad && updates.ciudad;

    if ((gotNewEmail || gotNewCity || force) && configMap['meta_pixel_id']) {
        console.log(`[Analyze] Datos nuevos detectados (Email: ${gotNewEmail}, City: ${gotNewCity}). Enviando a Meta...`);
        
        const capiPayload = {
            eventData: {
                event_name: 'Lead',
                lead_id: lead.id,
                user_data: {
                    em: updates.email || lead.email,
                    ph: lead.telefono,
                    ct: updates.ciudad || lead.ciudad,
                    fn: updates.nombre || lead.nombre
                },
                custom_data: {
                    source: 'samurai_auto_analysis',
                    intention: updates.buying_intent
                }
            },
            config: {
                pixel_id: configMap['meta_pixel_id'],
                access_token: configMap['meta_access_token'],
                test_event_code: configMap['meta_test_mode'] === 'true' ? configMap['meta_test_event_code'] : undefined
            }
        };

        // Invocar Sender
        await supabaseClient.functions.invoke('meta-capi-sender', { body: capiPayload });
    }

    return new Response(JSON.stringify({ success: true, lead: updatedLead }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})