// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.let('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const { lead_id, client_message } = await req.json();
    if (!lead_id) return new Response('no_id', { headers: corsHeaders });

    // LOG: Inicio de procesamiento
    await supabase.from('activity_logs').insert({ 
        action: 'UPDATE', resource: 'BRAIN', 
        description: `🧠 [IA INICIADA] Procesando respuesta para Lead ${lead_id}`, 
        status: 'OK' 
    });

    const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single();
    if (!lead) {
        await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'BRAIN', description: `❌ Lead ${lead_id} no encontrado`, status: 'ERROR' });
        return new Response('no_lead', { headers: corsHeaders });
    }
    
    if (lead.ai_paused) {
        await supabase.from('activity_logs').insert({ action: 'UPDATE', resource: 'BRAIN', description: `⏸️ IA pausada para ${lead.nombre}`, status: 'OK' });
        return new Response('paused', { headers: corsHeaders });
    }
    
    // PROTECCIÓN: No responder a leads cerrados
    if (lead.buying_intent === 'PERDIDO' || lead.buying_intent === 'COMPRADO') {
        // Auto-rescate: si el cliente escribe, sacarlo de PERDIDO
        if (lead.buying_intent === 'PERDIDO') {
            await supabase.from('leads').update({ buying_intent: 'BAJO' }).eq('id', lead.id);
            await supabase.from('activity_logs').insert({ 
                action: 'UPDATE', resource: 'BRAIN', 
                description: `🔄 Lead ${lead.nombre} rescatado de PERDIDO -> BAJO`, 
                status: 'OK' 
            });
        } else {
            return new Response('closed', { headers: corsHeaders });
        }
    }

    const { data: configs } = await supabase.from('app_config').select('key, value');
    const configMap = configs?.reduce((acc: any, item) => ({...acc, [item.key]: item.value}), {});
    const apiKey = configMap['openai_api_key'];

    if (!apiKey) {
        await supabase.from('activity_logs').insert({ 
            action: 'ERROR', resource: 'BRAIN', 
            description: "🚨 ERROR CRÍTICO: OpenAI API Key no configurada en Ajustes", 
            status: 'ERROR' 
        });
        return new Response('no_key', { headers: corsHeaders });
    }

    // Obtener historial de conversación
    const { data: history } = await supabase.from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: true })
        .limit(10);

    // Obtener constitución del Kernel
    const { data: kernel, error: kernelErr } = await supabase.functions.invoke('get-samurai-context', { body: { lead } });
    if (kernelErr) {
        await supabase.from('activity_logs').insert({ 
            action: 'ERROR', resource: 'BRAIN', 
            description: `⚠️ Fallo al obtener contexto del Kernel: ${kernelErr.message}`, 
            status: 'ERROR' 
        });
    }

    const systemPrompt = kernel?.system_prompt || "Eres Sam, asistente de ventas amigable y profesional.";

    const msgs = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map(h => ({ role: (['IA', 'SAMURAI', 'BOT'].includes(h.emisor)) ? 'assistant' : 'user', content: h.mensaje })),
        { role: 'user', content: client_message }
    ];

    // LOG: Llamando a OpenAI
    await supabase.from('activity_logs').insert({ 
        action: 'UPDATE', resource: 'BRAIN', 
        description: `📡 [OPENAI] Generando respuesta para ${lead.nombre}...`, 
        status: 'OK' 
    });

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages: msgs, temperature: 0.4 })
    });

    const aiData = await aiRes.json();
    
    // DETECTOR DE ERRORES OPENAI
    if (aiData.error) {
        await supabase.from('activity_logs').insert({ 
            action: 'ERROR', resource: 'BRAIN', 
            description: `🚨 ERROR OPENAI: ${aiData.error.message}`, 
            status: 'ERROR' 
        });
        return new Response('openai_error', { headers: corsHeaders });
    }

    const aiText = aiData.choices?.[0]?.message?.content || '';

    if (aiText) {
        // Enviar a WhatsApp
        const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-message-v3', { 
            body: { channel_id: lead.channel_id, phone: lead.telefono, message: aiText, lead_id: lead.id } 
        });
        
        // DETECTOR DE ERRORES WHATSAPP
        if (sendErr || (sendData && !sendData.success)) {
            await supabase.from('activity_logs').insert({ 
                action: 'ERROR', resource: 'SYSTEM', 
                description: `🚨 ERROR WHATSAPP (${lead.telefono}): ${sendErr?.message || sendData?.error}`, 
                status: 'ERROR' 
            });
        }

        // SIEMPRE registrar la respuesta en el chat
        await supabase.from('conversaciones').insert({ 
            lead_id: lead.id, emisor: 'IA', mensaje: aiText, platform: 'WHATSAPP' 
        });
        
        // LOG: Éxito
        await supabase.from('activity_logs').insert({ 
            action: 'UPDATE', resource: 'BRAIN', 
            description: `✅ [IA RESPONDIÓ] Mensaje enviado a ${lead.nombre}`, 
            status: 'OK' 
        });
    } else {
        await supabase.from('activity_logs').insert({ 
            action: 'ERROR', resource: 'BRAIN', 
            description: `⚠️ OpenAI devolvió respuesta vacía para ${lead.nombre}`, 
            status: 'ERROR' 
        });
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err: any) {
    await supabase.from('activity_logs').insert({ 
        action: 'ERROR', resource: 'SYSTEM', 
        message: `🚨 CRASH en IA: ${err.message}`, 
        status: 'ERROR' 
    });
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});