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

    // 1. Configuración
    const { data: lead } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    const { data: configs } = await supabaseClient.from('app_config').select('key, value').in('key', ['openai_api_key', 'meta_pixel_id', 'meta_access_token', 'webhook_sale']);
    
    const getConfig = (key) => configs.find(c => c.key === key)?.value;
    const apiKey = getConfig('openai_api_key');
    const webhookUrl = getConfig('webhook_sale');
    
    // 2. Historial
    const { data: messages } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead_id).order('created_at', { ascending: true }).limit(40);
    const transcript = messages.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n');

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
            response_format: { type: "json_object" }
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // 4. Guardar en DB
    const updatePayload: any = { last_ai_analysis: new Date().toISOString() };
    let dataDiscovered = false;

    if (result.email && result.email !== lead.email) { updatePayload.email = result.email.toLowerCase().trim(); dataDiscovered = true; }
    if (result.ciudad && result.ciudad !== lead.ciudad) { updatePayload.ciudad = result.ciudad; dataDiscovered = true; }
    if (result.nombre && (!lead.nombre || lead.nombre.includes('Nuevo'))) { updatePayload.nombre = result.nombre; dataDiscovered = true; }
    
    updatePayload.buying_intent = result.intent;
    updatePayload.summary = result.summary;
    updatePayload.perfil_psicologico = result.psych;

    const { data: updatedLead } = await supabaseClient.from('leads').update(updatePayload).eq('id', lead_id).select().single();

    // 5. NOTIFICAR AL CRM (Make.com) si hay datos nuevos
    if (dataDiscovered && webhookUrl) {
        console.log(`[crm-sync] Notificando a Make.com sobre nuevos datos de ${updatedLead.id}`);
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'lead_data_updated',
                lead_id: updatedLead.id,
                nombre: updatedLead.nombre,
                email: updatedLead.email,
                ciudad: updatedLead.ciudad,
                intent: updatedLead.buying_intent,
                source: 'samurai_ia_discovery'
            })
        }).catch(e => console.error("Error Webhook:", e));
    }

    // 6. AUTO-CAPI (Meta)
    const pixelId = getConfig('meta_pixel_id');
    const token = getConfig('meta_access_token');

    if (updatedLead.email && updatedLead.nombre && !updatedLead.capi_lead_event_sent_at && pixelId && token) {
        await supabaseClient.functions.invoke('meta-capi-sender', {
            body: {
                eventData: {
                    event_name: 'Lead',
                    lead_id: updatedLead.id,
                    user_data: { ph: updatedLead.telefono, em: updatedLead.email, fn: updatedLead.nombre, ct: updatedLead.ciudad }
                },
                config: { pixel_id: pixelId, access_token: token }
            }
        });
        await supabaseClient.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead_id);
    }

    return new Response(JSON.stringify({ success: true, lead: updatedLead }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})