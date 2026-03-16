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

  let lead_id_for_error = null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  try {
    const payload = await req.json();
    console.log("[Webhook] Payload recibido:", JSON.stringify(payload).substring(0, 300));

    // 1. EXTRAER DATOS (Parseo Universal)
    let phone = '';
    let text = '';
    let pushName = 'Nuevo Lead WhatsApp';

    // Evoluton API suele enviar en payload.data, pero a veces en payload directo
    const msgData = payload?.data && !Array.isArray(payload.data) ? payload.data : 
                    (Array.isArray(payload?.data) ? payload.data[0] : payload);

    // Si es un mensaje enviado por nosotros (del bot o vendedor), ignorar
    if (msgData?.key?.fromMe === true || msgData?.fromMe === true) {
        return new Response(JSON.stringify({ status: 'ignored', reason: 'fromMe' }), { headers: corsHeaders });
    }

    // Extraer Teléfono
    if (msgData?.key?.remoteJid) {
        phone = msgData.key.remoteJid.split('@')[0];
    } else if (msgData?.from) {
        phone = msgData.from.split('@')[0];
    } else if (msgData?.remoteJid) {
        phone = msgData.remoteJid.split('@')[0];
    }

    if (msgData?.pushName) pushName = msgData.pushName;
    
    // Extraer Texto
    text = msgData?.message?.conversation || 
           msgData?.message?.extendedTextMessage?.text || 
           msgData?.text?.body || 
           msgData?.text || 
           msgData?.message?.imageMessage?.caption ||
           '';

    if (!phone || !text) {
        console.log("[Webhook] Ignorado: Sin texto o teléfono válido.");
        return new Response(JSON.stringify({ status: 'ignored', reason: 'no_text_or_phone' }), { headers: corsHeaders });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    // 2. BUSCAR O CREAR LEAD
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone}%`).limit(1).maybeSingle();

    if (!lead) {
        const { data: newLead, error: insertError } = await supabaseClient.from('leads').insert({
            nombre: pushName,
            telefono: cleanPhone,
            platform: 'WHATSAPP'
        }).select().single();
        if (insertError) throw new Error("Error creando lead: " + insertError.message);
        lead = newLead;
    }
    
    lead_id_for_error = lead.id;

    // 3. GUARDAR MENSAJE DEL CLIENTE
    await supabaseClient.from('conversaciones').insert({
        lead_id: lead.id,
        emisor: 'CLIENTE',
        mensaje: text,
        platform: 'WHATSAPP'
    });
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    // 4. VERIFICAR KILL SWITCHES
    if (lead.ai_paused) {
        console.log(`[Webhook] IA pausada para el lead: ${lead.id}`);
        return new Response(JSON.stringify({ status: 'success', ai_status: 'paused' }), { headers: corsHeaders });
    }

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {}) || {};
    
    if (configMap['global_bot_paused'] === 'true') {
        console.log(`[Webhook] KILL SWITCH ACTIVADO. Bot globalmente pausado.`);
        return new Response(JSON.stringify({ status: 'success', ai_status: 'global_paused' }), { headers: corsHeaders });
    }

    // 5. OBTENER CONTEXTO DIRECTAMENTE (Sin llamar a get-samurai-context para evitar timeouts)
    const getConfig = (key, def = "") => configMap[key] || def;
    
    const bankData = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;
    
    const system_prompt = `
    ### ESTRATEGIA DE PERFILAMIENTO PSICOGRÁFICO:
    Usa la información técnica que tienes para educar y preguntar:
    1. Si el cliente pregunta por el sonido, menciona la "Psicoacústica" y pregunta: "¿Te interesa para uso personal o para integrarlo en alguna terapia que ya realices?"
    2. Usa datos del Cerebro Core para demostrar autoridad antes de pedir datos.
    3. REGLA WHATSAPP: Estás en WHATSAPP. Ya tienes su teléfono (${lead.telefono}). NO lo pidas.

    ${getConfig('prompt_alma_samurai')}
    ${getConfig('prompt_adn_core')}
    ${getConfig('prompt_behavior_rules')}
    ${getConfig('prompt_human_handoff')}

    ### [DATOS DE PAGO - VERDAD ABSOLUTA]
    ${bankData}
    `;

    // 6. OBTENER HISTORIAL
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

    // 7. LLAMAR A OPENAI
    const openaiKey = configMap['openai_api_key'];
    if (!openaiKey) throw new Error("Falta OpenAI API Key en la configuración del sistema.");

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

    if (!aiRes.ok) {
        const errText = await aiRes.text();
        throw new Error(`OpenAI API falló: ${errText}`);
    }

    const aiData = await aiRes.json();
    let aiResponseText = aiData.choices?.[0]?.message?.content || '';

    if (!aiResponseText) throw new Error("OpenAI devolvió una respuesta vacía.");

    // 8. DETECCIÓN DE HANDOFF
    if (aiResponseText.includes('{"request_human"')) {
         aiResponseText = aiResponseText.split('---')[0].trim() || "En un momento te atiende un asesor humano.";
         await supabaseClient.from('leads').update({ ai_paused: true }).eq('id', lead.id);
         await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, mensaje: "IA Pausada automáticamente por solicitud de humano.", emisor: 'NOTA', platform: 'SYSTEM' });
    }

    // 9. ENVIAR MENSAJE VÍA EVOLUTION API
    const evolutionUrl = configMap['evolution_api_url'];
    const evolutionKey = configMap['evolution_api_key'];

    if (evolutionUrl && evolutionKey) {
         console.log(`[Webhook] Enviando a Evolution API: ${evolutionUrl}`);
         const evoRes = await fetch(evolutionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
            body: JSON.stringify({ number: cleanPhone, text: aiResponseText })
         });
         
         if (!evoRes.ok) {
             const errText = await evoRes.text();
             throw new Error(`Evolution API falló HTTP ${evoRes.status}: ${errText}`);
         }
    } else {
         throw new Error("Credenciales de Evolution API incompletas. Configura URL y API Key en los ajustes.");
    }

    // 10. GUARDAR MENSAJE DEL BOT
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: aiResponseText, platform: 'WHATSAPP' });
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    // 11. TRIGGER ANALISTA (Background)
    fetch(`${supabaseUrl}/functions/v1/analyze-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({ lead_id: lead.id, force: false })
    }).catch(err => console.error("[Webhook] Error triggering analyst:", err));

    return new Response(JSON.stringify({ status: 'success' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("[Webhook] CRITICAL ERROR:", err);
    
    // Auto-reporte de error en el chat
    if (lead_id_for_error && supabaseClient) {
        await supabaseClient.from('conversaciones').insert({ 
            lead_id: lead_id_for_error, 
            mensaje: `[CRASH REPORT]: ${err.message}`, 
            emisor: 'IA', 
            platform: 'ERROR' 
        }).catch(console.error);
    }

    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
})