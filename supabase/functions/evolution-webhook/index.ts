// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de sub-rutas (por si Webhook by Events sigue encendido)
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  try {
    const payload = await req.json();
    console.log("[evolution-webhook] Evento detectado:", payload?.event || payload?.type);

    // 1. FILTRAR SOLO MENSAJES ENTRANTE
    const eventType = (payload?.event || payload?.type || '').toLowerCase();
    
    // Solo procesamos si el evento es de mensajes
    if (!eventType.includes('messages') && !eventType.includes('upsert') && !eventType.includes('chat')) {
        return new Response(JSON.stringify({ status: 'ignored', event: eventType }), { headers: corsHeaders });
    }

    const msgData = payload?.data || payload?.body || payload;
    const msg = Array.isArray(msgData) ? msgData[0] : msgData;

    // Ignorar si lo enviamos nosotros
    if (msg?.key?.fromMe === true || msg?.fromMe === true) {
        return new Response(JSON.stringify({ status: 'ignored', reason: 'fromMe' }), { headers: corsHeaders });
    }

    // Extraer Teléfono y Texto de forma agresiva
    const phone = msg?.key?.remoteJid?.split('@')[0] || msg?.from?.split('@')[0] || msg?.remoteJid?.split('@')[0];
    const text = msg?.message?.conversation || 
                 msg?.message?.extendedTextMessage?.text || 
                 msg?.text?.body || 
                 msg?.text || 
                 msg?.message?.imageMessage?.caption || '';

    if (!phone || !text) {
        return new Response(JSON.stringify({ status: 'ignored', reason: 'no_data' }), { headers: corsHeaders });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    // 2. BUSCAR O CREAR LEAD
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone}%`).limit(1).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({
            nombre: msg?.pushName || 'Nuevo Lead WhatsApp',
            telefono: cleanPhone,
            platform: 'WHATSAPP'
        }).select().single();
        lead = newLead;
    }

    // 3. GUARDAR MENSAJE
    await supabaseClient.from('conversaciones').insert({
        lead_id: lead.id,
        emisor: 'CLIENTE',
        mensaje: text,
        platform: 'WHATSAPP'
    });
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    // 4. LOGICA DE IA (Kill Switches)
    if (lead.ai_paused) return new Response(JSON.stringify({ status: 'success', ai: 'paused' }), { headers: corsHeaders });

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {}) || {};
    
    if (configMap['global_bot_paused'] === 'true') return new Response(JSON.stringify({ status: 'success', ai: 'global_paused' }), { headers: corsHeaders });

    // 5. PROCESAR RESPUESTA
    const openaiKey = configMap['openai_api_key'];
    const evolutionUrl = configMap['evolution_api_url'];
    const evolutionKey = configMap['evolution_api_key'];

    const bankData = `Banco: ${configMap['bank_name']}\nCuenta: ${configMap['bank_account']}\nCLABE: ${configMap['bank_clabe']}\nTitular: ${configMap['bank_holder']}`;
    const systemPrompt = `${configMap['prompt_alma_samurai']}\n${configMap['prompt_adn_core']}\n${configMap['prompt_behavior_rules']}\n### [PAGOS]\n${bankData}`;

    const { data: history } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(10);
    const messages = [{ role: 'system', content: systemPrompt }];
    history?.forEach(h => messages.push({ role: h.emisor === 'CLIENTE' ? 'user' : 'assistant', content: h.mensaje }));

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.7 })
    });

    const aiData = await aiRes.json();
    let aiText = aiData.choices?.[0]?.message?.content || '';

    // Enviar y Guardar
    await fetch(evolutionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
        body: JSON.stringify({ number: cleanPhone, text: aiText })
    });

    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: aiText, platform: 'WHATSAPP' });

    return new Response(JSON.stringify({ status: 'success' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});