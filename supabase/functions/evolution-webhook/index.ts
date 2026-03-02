// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const eventName = (body.event || "").toLowerCase();
    
    // 1. FILTRAR SOLO MENSAJES ENTRANTES
    if (eventName !== 'messages.upsert' && eventName !== 'messages_upsert') {
        return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messageData = body.data;
    if (!messageData || messageData.key?.fromMe) return new Response('Ignored');

    const remoteJid = messageData.key?.remoteJid;
    const phone = remoteJid.split('@')[0];
    const messageText = messageData.message?.conversation || 
                       messageData.message?.extendedTextMessage?.text || 
                       "Mensaje multimedia";
    const senderName = messageData.pushName || "Cliente";

    // 2. IDENTIFICAR O CREAR LEAD
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({ nombre: senderName, telefono: phone, buying_intent: 'BAJO' }).select().single();
        lead = newLead;
    }

    // 3. GUARDAR MENSAJE CLIENTE
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    if (lead.ai_paused) return new Response('AI Paused');

    // 4. OBTENER CONTEXTO
    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context');
    const { data: leadContext } = await supabaseClient.functions.invoke('get-lead-context', { queryString: `phone=${phone}` });

    // 5. GENERAR RESPUESTA (CON VERIFICACIÓN)
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const apiKey = configs.find(c => c.key === 'openai_api_key')?.value;
    
    if (!apiKey) throw new Error("OpenAI API Key no configurada en Ajustes.");

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { role: "system", content: kernelData?.system_prompt || "Eres el Samurai." },
                { role: "user", content: `CONTEXTO:\n${leadContext?.profile}\n\nMENSAJE:\n${messageText}` }
            ]
        })
    });

    const aiData = await aiRes.json();
    if (!aiData.choices || !aiData.choices[0]) {
        throw new Error(`OpenAI no respondió correctamente: ${JSON.stringify(aiData.error || 'Unknown error')}`);
    }
    const finalAnswer = aiData.choices[0].message.content;

    // 6. ENVIAR POR EVOLUTION API (Formato simplificado para evitar Error 400)
    const evoUrl = configs.find(c => c.key === 'evolution_api_url')?.value;
    const evoKey = configs.find(c => c.key === 'evolution_api_key')?.value;

    if (evoUrl && evoKey) {
        // Algunas versiones de Evolution prefieren el campo "text" directo o dentro de "textMessage"
        const sendRes = await fetch(evoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
            body: JSON.stringify({
                number: phone,
                text: finalAnswer // Formato estandar Evolution API v2
            })
        });
        
        if (!sendRes.ok) {
            const errorText = await sendRes.text();
            throw new Error(`Evolution API Error ${sendRes.status}: ${errorText}`);
        }

        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: finalAnswer, platform: 'WHATSAPP_AUTO' });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    await supabaseClient.from('activity_logs').insert({
        action: 'ERROR', resource: 'SYSTEM', status: 'ERROR',
        description: `Webhook Error: ${error.message}`
    });
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})