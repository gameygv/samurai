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

    const { lead_id } = await req.json();
    if (!lead_id) throw new Error("Lead ID requerido.");

    // 1. Configuración y Datos Previos
    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    
    const getConfig = (key) => configs?.find(c => c.key === key)?.value;
    const apiKey = getConfig('openai_api_key');
    const pixelId = getConfig('meta_pixel_id');
    const metaToken = getConfig('meta_access_token');
    const webhookUrl = getConfig('webhook_sale');

    if (!apiKey) throw new Error("OpenAI API Key faltante.");

    // 2. Obtener Historial
    const { data: messages } = await supabaseClient
        .from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead_id)
        .order('created_at', { ascending: true }) 
        .limit(50);

    const transcript = messages?.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n') || '';

    // 3. IA Extrae Datos
    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Extrae JSON puro: {email, ciudad, nombre, intent, summary, psych}" },
                { role: "user", content: `Analiza este chat:\n${transcript}` }
            ],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // 4. Lógica de Actualización (Detectar Cambios)
    const updatePayload: any = {
        last_ai_analysis: new Date().toISOString(),
        buying_intent: result.intent || lead.buying_intent,
        summary: result.summary || lead.summary,
        perfil_psicologico: result.psych || lead.perfil_psicologico
    };

    let dataDiscovered = false;

    // Solo actualizamos si el dato nuevo es mejor que el viejo
    if (result.email && result.email.includes('@') && result.email !== lead.email) {
        updatePayload.email = result.email.toLowerCase().trim();
        dataDiscovered = true;
    }
    if (result.ciudad && result.ciudad.length > 2 && result.ciudad !== lead.ciudad) {
        updatePayload.ciudad = result.ciudad.trim();
        dataDiscovered = true; // Ciudad cuenta como descubrimiento importante
    }
    if (result.nombre && result.nombre.length > 2 && (!lead.nombre || lead.nombre.includes('Nuevo'))) {
        updatePayload.nombre = result.nombre.trim();
        dataDiscovered = true;
    }

    const { data: updatedLead, error: updateError } = await supabaseClient
        .from('leads')
        .update(updatePayload)
        .eq('id', lead_id)
        .select()
        .single();

    if (updateError) throw updateError;

    // 5. EVENTO 1: CRM SYNC (Make.com)
    // Se dispara si hubo datos nuevos O si el intent cambió a ALTO
    if ((dataDiscovered || result.intent === 'ALTO') && webhookUrl) {
        console.log(`[crm-sync] Enviando actualización a CRM para ${updatedLead.email || lead_id}`);
        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'lead_data_updated',
                lead_id: updatedLead.id,
                nombre: updatedLead.nombre,
                email: updatedLead.email,
                ciudad: updatedLead.ciudad,
                telefono: updatedLead.telefono,
                intent: updatedLead.buying_intent,
                source: 'samurai_ia_discovery'
            })
        }).catch(e => console.error("Error CRM Webhook:", e));
    }

    // 6. EVENTO 2: META CAPI
    // Se dispara si tenemos los 3 datos clave y no se ha enviado hoy
    if (updatedLead.email && updatedLead.nombre && !updatedLead.capi_lead_event_sent_at && pixelId && metaToken) {
        console.log(`[auto-capi] Disparando evento Lead para ${updatedLead.email}`);
        await supabaseClient.functions.invoke('meta-capi-sender', {
            body: {
                eventData: {
                    event_name: 'Lead',
                    lead_id: updatedLead.id,
                    user_data: { 
                        ph: updatedLead.telefono, 
                        em: updatedLead.email, 
                        fn: updatedLead.nombre, 
                        ct: updatedLead.ciudad 
                    },
                    custom_data: { 
                        intent: updatedLead.buying_intent,
                        source: 'auto_analysis'
                    }
                },
                config: { pixel_id: pixelId, access_token: metaToken }
            }
        });
        await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead_id);
    }

    return new Response(JSON.stringify({ success: true, lead: updatedLead, extracted: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 200, headers: corsHeaders });
  }
})