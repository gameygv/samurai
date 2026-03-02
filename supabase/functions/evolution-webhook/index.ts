// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log("[evolution-webhook] Evento recibido:", body.event);

    // 1. FILTRAR SOLO MENSAJES ENTRANTES (Upsert)
    if (body.event !== 'messages.upsert') {
        return new Response(JSON.stringify({ ignored: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const messageData = body.data;
    const fromMe = messageData.key.fromMe;
    if (fromMe) return new Response('Ignored own message');

    const remoteJid = messageData.key.remoteJid;
    const phone = remoteJid.split('@')[0];
    const messageText = messageData.message?.conversation || 
                       messageData.message?.extendedTextMessage?.text || 
                       "Mensaje multimedia (no texto)";
    const senderName = messageData.pushName || "Cliente WhatsApp";

    console.log(`[evolution-webhook] Mensaje de ${phone}: ${messageText}`);

    // 2. IDENTIFICAR O CREAR LEAD
    let { data: lead } = await supabaseClient
        .from('leads')
        .select('*')
        .or(`telefono.ilike.%${phone}%`)
        .maybeSingle();

    if (!lead) {
        console.log(`[evolution-webhook] Nuevo prospecto detectado: ${phone}`);
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

    // Actualizar última actividad
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    // 4. ¿LA IA DEBE RESPONDER?
    if (lead.ai_paused) {
        console.log(`[evolution-webhook] IA en #STOP para ${phone}. Ignorando respuesta.`);
        return new Response('AI Paused');
    }

    // 5. LLAMAR AL CEREBRO (Kernel)
    // Obtenemos el contexto completo (ADN + Verdad Maestra + Historial)
    const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context');
    const { data: leadContext } = await supabaseClient.functions.invoke('get-lead-context', {
        queryString: `phone=${phone}`
    });

    // 6. GENERAR RESPUESTA CON OPENAI (Motor Principal)
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const apiKey = configs.find(c => c.key === 'openai_api_key')?.value;
    
    if (!apiKey) throw new Error("OpenAI API Key no configurada.");

    const prompt = `
        ${kernelData.system_prompt}

        HISTORIAL RECIENTE Y PERFIL:
        ${leadContext.history}
        ${leadContext.profile}

        ÚLTIMO MENSAJE DEL CLIENTE:
        "${messageText}"

        INSTRUCCIÓN: Responde como el Samurai. Sé breve, directo y sigue el protocolo de las 3 fases.
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
    const finalAnswer = aiData.choices[0].message.content;

    // 7. ENVIAR RESPUESTA POR EVOLUTION API
    const evoUrl = configs.find(c => c.key === 'evolution_api_url')?.value;
    const evoKey = configs.find(c => c.key === 'evolution_api_key')?.value;

    if (evoUrl && evoKey) {
        await fetch(evoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
            body: JSON.stringify({
                number: phone,
                options: { delay: 1000, presence: 'composing' },
                textMessage: { text: finalAnswer },
            })
        });

        // 8. GUARDAR RESPUESTA DE LA IA EN DB
        await supabaseClient.from('conversaciones').insert({
            lead_id: lead.id,
            emisor: 'SAMURAI',
            mensaje: finalAnswer,
            platform: 'WHATSAPP_AUTO'
        });
    }

    // 9. DISPARAR ANÁLISIS EN BACKGROUND (Descubrimiento de datos)
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/analyze-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead_id: lead.id })
    }).catch(e => console.error("Error auto-analisis:", e));

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("[evolution-webhook] Error crítico:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})