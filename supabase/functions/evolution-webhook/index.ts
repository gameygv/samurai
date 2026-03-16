// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Manejo de CORS Pre-flight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  try {
    const payload = await req.json();
    
    // LOG DE EMERGENCIA: Esto aparecerá en los logs de Supabase si la función se ejecuta
    console.log("[Webhook] Petición recibida con éxito. Evento:", payload?.event || payload?.type || 'unknown');

    // 2. FILTRAR MENSAJES (Búsqueda agresiva de texto y teléfono)
    const msgData = payload?.data || payload?.body || payload;
    const msg = Array.isArray(msgData) ? msgData[0] : msgData;

    // Ignorar si lo enviamos nosotros
    if (msg?.key?.fromMe === true || msg?.fromMe === true) {
        return new Response(JSON.stringify({ status: 'ignored', reason: 'fromMe' }), { headers: corsHeaders });
    }

    const phone = msg?.key?.remoteJid?.split('@')[0] || msg?.from?.split('@')[0] || msg?.remoteJid?.split('@')[0];
    const text = msg?.message?.conversation || 
                 msg?.message?.extendedTextMessage?.text || 
                 msg?.text?.body || 
                 msg?.text || 
                 msg?.message?.imageMessage?.caption || '';

    if (!phone || !text) {
        // Si no hay texto, tal vez es un evento de conexión, lo ignoramos pero respondemos OK
        return new Response(JSON.stringify({ status: 'heartbeat_received' }), { headers: corsHeaders });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    // 3. BUSCAR O CREAR LEAD (Con política de bypass)
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone}%`).limit(1).maybeSingle();
    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({
            nombre: msg?.pushName || 'Nuevo Lead WhatsApp',
            telefono: cleanPhone,
            platform: 'WHATSAPP'
        }).select().single();
        lead = newLead;
    }

    // 4. GUARDAR MENSAJE
    await supabaseClient.from('conversaciones').insert({
        lead_id: lead.id,
        emisor: 'CLIENTE',
        mensaje: text,
        platform: 'WHATSAPP'
    });
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    // 5. RESPUESTA DE IA (Solo si no está pausado)
    if (lead.ai_paused) return new Response(JSON.stringify({ status: 'ai_paused' }), { headers: corsHeaders });

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {}) || {};
    
    if (configMap['global_bot_paused'] === 'true') return new Response(JSON.stringify({ status: 'global_paused' }), { headers: corsHeaders });

    const openaiKey = configMap['openai_api_key'];
    const evolutionUrl = configMap['evolution_api_url'];
    const evolutionKey = configMap['evolution_api_key'];

    if (!openaiKey || !evolutionUrl || !evolutionKey) {
        return new Response(JSON.stringify({ status: 'missing_config' }), { headers: corsHeaders });
    }

    // Armar Prompt
    const bankData = `Banco: ${configMap['bank_name']}\nCuenta: ${configMap['bank_account']}\nCLABE: ${configMap['bank_clabe']}\nTitular: ${configMap['bank_holder']}`;
    const systemPrompt = `${configMap['prompt_alma_samurai']}\n${configMap['prompt_adn_core']}\n${configMap['prompt_behavior_rules']}\n### [PAGOS]\n${bankData}`;

    const { data: history } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(10);
    const messages = [{ role: 'system', content: systemPrompt }];
    history?.forEach(h => messages.push({ role: h.emisor === 'CLIENTE' ? 'user' : 'assistant', content: h.mensaje }));

    // IA Request
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.7 })
    });

    const aiData = await aiRes.json();
    let aiText = aiData.choices?.[0]?.message?.content || '';

    // Enviar y Guardar
    if (aiText) {
        await fetch(evolutionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionKey },
            body: JSON.stringify({ number: cleanPhone, text: aiText })
        });
        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: aiText, platform: 'WHATSAPP' });
    }

    return new Response(JSON.stringify({ status: 'success' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});