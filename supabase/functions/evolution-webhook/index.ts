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
    
    console.log(`[evolution-webhook] Evento detectado: ${eventName}`);

    // 1. FILTRAR SOLO MENSAJES ENTRANTES (Upsert)
    if (eventName !== 'messages.upsert' && eventName !== 'messages_upsert') {
        return new Response(JSON.stringify({ ignored: true, event: eventName }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messageData = body.data;
    if (!messageData) throw new Error("Payload 'data' no encontrado en el webhook.");

    const fromMe = messageData.key?.fromMe;
    if (fromMe) {
       console.log("[evolution-webhook] Mensaje propio detectado. Ignorando.");
       return new Response('Ignored own message');
    }

    const remoteJid = messageData.key?.remoteJid;
    if (!remoteJid) throw new Error("remoteJid no encontrado.");

    const phone = remoteJid.split('@')[0];
    const messageText = messageData.message?.conversation || 
                       messageData.message?.extendedTextMessage?.text || 
                       "Mensaje multimedia (no texto)";
    const senderName = messageData.pushName || "Cliente WhatsApp";

    console.log(`[evolution-webhook] Procesando mensaje de ${phone}: "${messageText}"`);

    // 2. IDENTIFICAR O CREAR LEAD
    let { data: lead } = await supabaseClient
        .from('leads')
        .select('*')
        .or(`telefono.ilike.%${phone}%`)
        .maybeSingle();

    if (!lead) {
        console.log(`[evolution-webhook] Creando nuevo prospecto: ${phone}`);
        const { data: newLead } = await supabaseClient.from('leads').insert({
            nombre: senderName,
            telefono: phone,
            buying_intent: 'BAJO'
        }).select().single();
        lead = newLead;
    }

    // 3. GUARDAR MENSAJE DEL CLIENTE
    await supabaseClient.from('conversaciones').insert({
        lead_id: lead.id,
        emisor: 'CLIENTE',
        mensaje: messageText,
        platform: 'WHATSAPP'
    });

    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    // 4. ¿LA IA DEBE RESPONDER?
    if (lead.ai_paused) {
        console.log(`[evolution-webhook] IA pausada para ${phone}.`);
        return new Response('AI Paused');
    }

    // 5. OBTENER CEREBRO Y CONTEXTO
    const [{ data: kernelData }, { data: leadContext }] = await Promise.all([
        supabaseClient.functions.invoke('get-samurai-context'),
        supabaseClient.functions.invoke('get-lead-context', { queryString: `phone=${phone}` })
    ]);

    // 6. GENERAR RESPUESTA
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const apiKey = configs.find(c => c.key === 'openai_api_key')?.value;
    
    if (!apiKey) throw new Error("OpenAI API Key faltante en la base de datos.");

    const prompt = `
        ${kernelData?.system_prompt || ""}
        ---
        HISTORIAL Y PERFIL:
        ${leadContext?.history || ""}
        ${leadContext?.profile || ""}
        ---
        MENSAJE: "${messageText}"
        INSTRUCCIÓN: Responde breve y directo siguiendo el protocolo Samurai.
    `;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7
        })
    });

    const aiData = await aiRes.json();
    const finalAnswer = aiData.choices[0]?.message?.content;
    
    if (!finalAnswer) throw new Error("La IA no generó respuesta.");

    // 7. ENVIAR POR EVOLUTION API
    const evoUrl = configs.find(c => c.key === 'evolution_api_url')?.value;
    const evoKey = configs.find(c => c.key === 'evolution_api_key')?.value;

    if (evoUrl && evoKey) {
        console.log(`[evolution-webhook] Enviando respuesta a ${phone} vía Evolution API...`);
        const sendRes = await fetch(evoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
            body: JSON.stringify({
                number: phone,
                options: { delay: 1000, presence: 'composing' },
                textMessage: { text: finalAnswer },
            })
        });
        
        if (!sendRes.ok) throw new Error(`Fallo Evolution API al enviar: ${sendRes.status}`);

        // 8. GUARDAR RESPUESTA IA
        await supabaseClient.from('conversaciones').insert({
            lead_id: lead.id,
            emisor: 'SAMURAI',
            mensaje: finalAnswer,
            platform: 'WHATSAPP_AUTO'
        });
        
        console.log("[evolution-webhook] Mensaje enviado con éxito.");
    }

    // 9. ANÁLISIS EN SEGUNDO PLANO
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead_id: lead.id })
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("[evolution-webhook] Error:", error.message);
    
    // Registrar error en logs visibles para el usuario
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    await supabaseClient.from('activity_logs').insert({
        action: 'ERROR',
        resource: 'SYSTEM',
        description: `Webhook Error: ${error.message}`,
        status: 'ERROR'
    });

    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})