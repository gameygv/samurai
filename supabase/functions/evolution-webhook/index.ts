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
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const body = await req.json();
    const eventName = (body.event || "").toLowerCase();
    
    if (eventName !== 'messages.upsert' && eventName !== 'messages_upsert') {
        return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messageData = body.data;
    if (!messageData || messageData.key?.fromMe) return new Response('Ignored');

    const remoteJid = messageData.key?.remoteJid;
    const phone = remoteJid.split('@')[0];
    const messageText = messageData.message?.conversation || messageData.message?.extendedTextMessage?.text || "Mensaje multimedia";
    const senderName = messageData.pushName || "Cliente";

    // 1. IDENTIFICAR O CREAR LEAD
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${phone}%`).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({ nombre: senderName, telefono: phone, buying_intent: 'BAJO' }).select().single();
        lead = newLead;
    }

    // 2. GUARDAR MENSAJE CLIENTE
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP' });
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    if (lead.ai_paused) return new Response('AI Paused');

    // 3. OBTENER CONTEXTO MAESTRO (ADN + WEB)
    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context');

    // 4. OBTENER HISTORIAL REAL (MEMORIA DE HILO)
    const { data: historyMsgs } = await supabaseClient
        .from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true })
        .limit(15);

    // Mapear historial al formato de OpenAI
    const thread = (historyMsgs || []).map(m => ({
        role: (m.emisor === 'CLIENTE' || m.emisor === 'HUMANO') ? 'user' : 'assistant',
        content: m.mensaje
    }));

    // 5. CONSTRUIR PROMPT DINÁMICO
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const apiKey = configs.find(c => c.key === 'openai_api_key')?.value;
    
    if (!apiKey) throw new Error("OpenAI API Key no configurada.");

    // Perfil del lead para que la IA sepa qué datos ya tiene
    const leadProfile = `
DATOS ACTUALES DEL CLIENTE (Usa esto para no repetir preguntas):
- NOMBRE: ${lead.nombre}
- CIUDAD: ${lead.ciudad || 'Desconocida'}
- EMAIL: ${lead.email || 'No capturado'}
- INTENCIÓN: ${lead.buying_intent}
    `.trim();

    const messages = [
        { role: "system", content: `${kernelData?.system_prompt}\n\n${leadProfile}` },
        ...thread
    ];

    // 6. GENERAR RESPUESTA
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: messages,
            temperature: 0.7
        })
    });

    const aiData = await aiRes.json();
    const finalAnswer = aiData.choices[0].message.content;

    // 7. ENVIAR POR EVOLUTION API
    const evoUrl = configs.find(c => c.key === 'evolution_api_url')?.value;
    const evoKey = configs.find(c => c.key === 'evolution_api_key')?.value;

    if (evoUrl && evoKey) {
        await fetch(evoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
            body: JSON.stringify({ number: phone, text: finalAnswer })
        });

        // 8. GUARDAR RESPUESTA IA
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: finalAnswer, platform: 'WHATSAPP_AUTO' });
    }

    // 9. DISPARAR ANÁLISIS (Detección de datos en background)
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead_id: lead.id })
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    await supabaseClient.from('activity_logs').insert({ action: 'ERROR', resource: 'SYSTEM', status: 'ERROR', description: `Webhook Error: ${error.message}` });
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})