// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const payload = await req.json();
    console.log("[Webhook] Payload recibido:", JSON.stringify(payload).substring(0, 300));

    // 1. Extraer datos (Evolution API format)
    let phone = '';
    let text = '';
    let pushName = 'Nuevo Lead WhatsApp';

    // Manejar diferentes formatos de payload de Evolution API / WABA
    const msgData = payload?.data || payload?.body || payload;
    
    // Ignorar mensajes enviados por nosotros mismos (para evitar bucles)
    if (msgData?.key?.fromMe) {
        return new Response(JSON.stringify({ status: 'ignored', reason: 'fromMe' }), { headers: corsHeaders });
    }

    if (msgData?.key?.remoteJid) {
        phone = msgData.key.remoteJid.split('@')[0];
    } else if (msgData?.from) {
        phone = msgData.from;
    }

    if (msgData?.pushName) pushName = msgData.pushName;
    
    text = msgData?.message?.conversation || 
           msgData?.message?.extendedTextMessage?.text || 
           msgData?.text?.body || 
           msgData?.text || '';

    if (!phone || !text) {
        console.log("[Webhook] Sin texto o teléfono válido.");
        return new Response(JSON.stringify({ status: 'ignored', reason: 'no_text_or_phone' }), { headers: corsHeaders });
    }

    // 2. Setup Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Limpiar teléfono
    const cleanPhone = phone.replace(/\D/g, '');

    // 3. Buscar o crear Lead
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone}%`).limit(1).maybeSingle();

    if (!lead) {
        const { data: newLead, error: insertError } = await supabaseClient.from('leads').insert({
            nombre: pushName,
            telefono: cleanPhone,
            platform: 'WHATSAPP'
        }).select().single();
        if (insertError) throw insertError;
        lead = newLead;
        console.log(`[Webhook] Nuevo lead creado: ${lead.id}`);
    }

    // 4. Guardar mensaje del cliente
    await supabaseClient.from('conversaciones').insert({
        lead_id: lead.id,
        emisor: 'CLIENTE',
        mensaje: text,
        platform: 'WHATSAPP'
    });
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    // 5. Verificar si el bot está pausado (Kill Switch Individual)
    if (lead.ai_paused) {
        console.log(`[Webhook] IA pausada para el lead: ${lead.id}`);
        return new Response(JSON.stringify({ status: 'success', ai_status: 'paused' }), { headers: corsHeaders });
    }

    // Verificar Kill Switch Global
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {}) || {};
    
    if (configMap['global_bot_paused'] === 'true') {
        console.log(`[Webhook] KILL SWITCH ACTIVADO. Bot globalmente pausado.`);
        return new Response(JSON.stringify({ status: 'success', ai_status: 'global_paused' }), { headers: corsHeaders });
    }

    // 6. Obtener Contexto del Cerebro Core (Pasando 'platform' para frenar pedir teléfonos)
    const contextRes = await fetch(`${supabaseUrl}/functions/v1/get-samurai-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead, platform: 'WHATSAPP', has_phone: true })
    });
    const { system_prompt } = await contextRes.json();

    // 7. Obtener Historial de Mensajes (Últimos 15)
    const { data: messages } = await supabaseClient.from('conversaciones')
        .select('emisor, mensaje, platform')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true })
        .limit(15);

    const openAiMessages = [{ role: 'system', content: system_prompt }];
    
    messages?.forEach(m => {
        if (m.emisor === 'NOTA' || m.platform === 'ERROR') return;
        const role = (m.emisor === 'CLIENTE') ? 'user' : 'assistant';
        openAiMessages.push({ role, content: m.mensaje });
    });

    // 8. Llamar a OpenAI
    const openaiKey = configMap['openai_api_key'];
    if (!openaiKey) throw new Error("Falta OpenAI API Key");

    console.log(`[Webhook] Consultando OpenAI para lead ${lead.id}...`);
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: openAiMessages,
            temperature: 0.6
        })
    });

    const aiData = await aiRes.json();
    let aiResponseText = aiData.choices?.[0]?.message?.content || '';

    // 9. Detección de Handoff (Petición de Humano)
    if (aiResponseText.includes('{"request_human"')) {
         aiResponseText = aiResponseText.split('---')[0].trim() || "En un momento te atiende un asesor humano.";
         await supabaseClient.from('leads').update({ ai_paused: true }).eq('id', lead.id);
         await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, mensaje: "IA Pausada automáticamente por solicitud de humano.", emisor: 'NOTA', platform: 'SYSTEM' });
    }

    // 10. Enviar mensaje por Evolution API
    const evolutionUrl = configMap['evolution_api_url'];
    const evolutionKey = configMap['evolution_api_key'];

    if (evolutionUrl && evolutionKey && aiResponseText) {
         const evoRes = await fetch(evolutionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
            body: JSON.stringify({ number: cleanPhone, text: aiResponseText })
         });
         
         if (!evoRes.ok) {
             const errText = await evoRes.text();
             console.error("[Webhook] Error Evolution API:", errText);
             await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, mensaje: `Error enviando a WhatsApp: ${errText}`, emisor: 'IA', platform: 'ERROR' });
         }
    }

    // 11. Guardar mensaje de la IA
    if (aiResponseText) {
         await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: aiResponseText, platform: 'WHATSAPP' });
         await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);
    }

    // 12. Trigger Analista en Background (Para perfilar y Meta CAPI)
    fetch(`${supabaseUrl}/functions/v1/analyze-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead_id: lead.id, force: false })
    }).catch(err => console.error("[Webhook] Error triggering analyst:", err));

    return new Response(JSON.stringify({ status: 'success' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("[Webhook] CRITICAL ERROR:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
})