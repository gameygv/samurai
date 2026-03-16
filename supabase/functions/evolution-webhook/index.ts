// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Identificar el canal por parámetro de URL
    const url = new URL(req.url);
    const channelId = url.searchParams.get('channel_id');
    
    const payload = await req.json();
    const eventType = payload?.event || payload?.type || 'unknown';

    // Log para el monitor en vivo
    await supabaseClient.from('activity_logs').insert({
        action: 'UPDATE',
        resource: 'SYSTEM',
        description: `Webhook Hit [Channel: ${channelId || 'Global'}]: ${eventType}`,
        status: 'OK',
        metadata: { event: eventType, channel: channelId }
    }).catch(() => {});

    // Responder a eventos de conexión
    if (eventType.includes('connection') || eventType.includes('status')) {
        return new Response(JSON.stringify({ status: 'connected' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Extraer datos según el proveedor (Detección de formato)
    let phone, text, pushName;
    
    // CASO A: Evolution API
    if (payload.data || payload.instance) {
       const msgData = payload.data?.[0] || payload.data || payload;
       if (msgData?.key?.fromMe) return new Response('ignored_me', { headers: corsHeaders });
       
       phone = msgData?.key?.remoteJid?.split('@')[0] || msgData?.from?.split('@')[0];
       text = msgData?.message?.conversation || msgData?.message?.extendedTextMessage?.text || msgData?.text || '';
       pushName = payload.pushName || msgData?.pushName || 'Nuevo Lead';
    } 
    // CASO B: GOWA (Go-WhatsApp)
    else if (payload.phone && payload.message) {
       phone = payload.phone;
       text = payload.message;
       pushName = payload.sender_name || 'Nuevo Lead GOWA';
    }

    if (!phone || !text) return new Response('no_data', { headers: corsHeaders });

    const cleanPhone = phone.replace(/\D/g, '');

    // 3. Obtener/Crear Lead vinculando el Canal
    let { data: lead } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone}%`).limit(1).maybeSingle();
    
    const leadUpdate = {
        last_message_at: new Date().toISOString(),
        channel_id: channelId || lead?.channel_id // Mantener canal previo o asignar el nuevo
    };

    if (!lead) {
        const { data: newLead } = await supabaseClient.from('leads').insert({
            nombre: pushName,
            telefono: cleanPhone,
            platform: 'WHATSAPP',
            channel_id: channelId
        }).select().single();
        lead = newLead;
    } else {
        await supabaseClient.from('leads').update(leadUpdate).eq('id', lead.id);
    }

    // Guardar mensaje
    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, 
        emisor: 'CLIENTE', 
        mensaje: text, 
        platform: 'WHATSAPP' 
    });

    if (lead.ai_paused) return new Response('ai_paused', { headers: corsHeaders });

    // 4. Lógica de IA (Obtener config del Canal Específico)
    let channelConfig = null;
    if (channelId) {
        const { data } = await supabaseClient.from('whatsapp_channels').select('*').eq('id', channelId).single();
        channelConfig = data;
    }

    // Si no hay canal específico, intentar usar la config global (Legacy)
    const { data: globalConfigs } = await supabaseClient.from('app_config').select('key, value');
    const configMap = globalConfigs?.reduce((acc, item) => ({...acc, [item.key]: item.value}), {}) || {};
    
    if (configMap['global_bot_paused'] === 'true') return new Response('global_paused', { headers: corsHeaders });

    const openaiKey = configMap['openai_api_key'];
    
    // Determinar credenciales de salida
    const apiUrl = channelConfig?.api_url || configMap['evolution_api_url'];
    const apiKey = channelConfig?.api_key || configMap['evolution_api_key'];
    const instance = channelConfig?.instance_id || '';
    const provider = channelConfig?.provider || 'evolution';

    // Generar respuesta IA
    const { data: history } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(10);
    const systemPrompt = `${configMap['prompt_alma_samurai']}\n${configMap['prompt_adn_core']}\n${configMap['prompt_behavior_rules']}`;
    
    const messages = [{ role: 'system', content: systemPrompt }];
    history?.forEach(h => messages.push({ role: h.emisor === 'CLIENTE' ? 'user' : 'assistant', content: h.mensaje }));

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages, temperature: 0.7 })
    });

    const aiData = await aiRes.json();
    const aiText = aiData.choices?.[0]?.message?.content || '';

    if (aiText) {
        // Enviar según el proveedor del canal
        let endpoint = apiUrl;
        let body = {};

        if (provider === 'evolution') {
            endpoint = `${apiUrl}/message/sendText/${instance}`;
            body = { number: cleanPhone, text: aiText };
        } else {
            endpoint = `${apiUrl}/send-message`;
            body = { phone: cleanPhone, message: aiText };
        }

        await fetch(endpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                [provider === 'evolution' ? 'apikey' : 'Authorization']: provider === 'evolution' ? apiKey : `Bearer ${apiKey}` 
            },
            body: JSON.stringify(body)
        });

        await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'IA', mensaje: aiText, platform: 'WHATSAPP' });
    }

    return new Response('success', { headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 200, headers: corsHeaders });
  }
});