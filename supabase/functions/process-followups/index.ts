// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  console.log("[process-followups] Iniciando ciclo AI-Driven...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const now = new Date();
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key, defaultVal) => configs?.find(c => c.key === key)?.value || defaultVal;

    const delays = {
       1: parseInt(getConfig('sales_reminder_1', 24)), 
       2: parseInt(getConfig('sales_reminder_2', 48)), 
       3: parseInt(getConfig('sales_reminder_3', 72)), 
       4: parseInt(getConfig('sales_reminder_4', 7)) * 24   
    };
    const engagementDelayHours = parseInt(getConfig('engagement_reminder_hours', 24));
    
    const evolutionApiUrl = getConfig('evolution_api_url', null);
    const evolutionApiKey = getConfig('evolution_api_key', null);
    const openAiKey = getConfig('openai_api_key', null);

    if (!openAiKey) throw new Error("Falta OpenAI API Key para generar los mensajes.");

    const results = [];
    const reactivated = [];

    // Helper para generar mensaje con IA y enviarlo
    const generateAndSend = async (lead, triggerInstruction, type) => {
        try {
            // 1. Obtener Contexto Completo (Tus Prompts del Panel)
            const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead } });
            
            // 2. Obtener Historial de Chat
            const { data: history } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(10);
            const historyMsgs = history ? history.reverse() : [];

            // 3. IA Genera el mensaje basado en TUS REGLAS
            const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: kernelData?.system_prompt },
                        ...historyMsgs.map(m => ({ role: (m.emisor === 'CLIENTE' || m.emisor === 'HUMANO') ? 'user' : 'assistant', content: m.mensaje })),
                        { role: "system", content: triggerInstruction }
                    ],
                    temperature: 0.4
                })
            });

            if (!aiRes.ok) throw new Error("Fallo en OpenAI");
            const aiData = await aiRes.json();
            const rawAnswer = aiData.choices?.[0]?.message?.content || "";
            
            const mediaRegex = /<<MEDIA:(.*?)>>/;
            const mediaMatch = rawAnswer.match(mediaRegex);
            const mediaUrl = mediaMatch ? mediaMatch[1] : null;
            let textToSend = rawAnswer.replace(mediaRegex, '').trim();

            if (!textToSend) return false;

            // 4. Enviar por Evolution API v2
            if (evolutionApiUrl && evolutionApiKey) {
                if (mediaUrl) {
                    await fetch(evolutionApiUrl.replace('message/sendText', 'message/sendMedia'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
                        body: JSON.stringify({ number: lead.telefono, mediaMessage: { mediatype: "image", media: mediaUrl, caption: textToSend }, delay: 1500 })
                    });
                } else {
                    await fetch(evolutionApiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
                        body: JSON.stringify({ number: lead.telefono, text: textToSend, delay: 1500, linkPreview: true })
                    });
                }
            }

            // 5. Guardar en Base de Datos
            await supabaseClient.from('conversaciones').insert({ 
                lead_id: lead.id, emisor: 'SAMURAI', 
                mensaje: mediaUrl ? `[IMG: ${mediaUrl}] ${rawAnswer}` : rawAnswer, 
                platform: 'AUTO_FOLLOWUP' 
            });

            return true;
        } catch (e) {
            console.error(`[process-followups] Error en ${lead.id}:`, e);
            return false;
        }
    };

    // ==========================================
    // FLUJO 1: CIERRE DE VENTAS (HIGH INTENT)
    // ==========================================
    const { data: hotLeads } = await supabaseClient
      .from('leads').select('*').eq('buying_intent', 'ALTO').neq('ai_paused', true).neq('buying_intent', 'COMPRADO').lt('followup_stage', 5).limit(5); // Lote para no saturar memoria

    for (const lead of (hotLeads || [])) {
       const lastInteraction = new Date(lead.last_message_at || lead.created_at); 
       const diffHours = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);
       const nextStage = (lead.followup_stage || 0) + 1;

       if (delays[nextStage] && diffHours >= delays[nextStage]) {
          // El Trigger inyecta la instrucción invisible para que la IA actúe
          const triggerInstruction = `[INSTRUCCIÓN DE SISTEMA]: El cliente lleva ${Math.round(diffHours)} horas sin responder y tiene una intención de compra ALTA. Ejecuta estrictamente el protocolo correspondiente a la FASE ${nextStage} de tu [ESTRATEGIA DE CIERRE Y FASES]. Escribe solo el mensaje final que le enviarás, manteniendo tu personalidad de Sam. Ofrécele siempre el Link de Tarjeta o Transferencia de tus Datos Financieros.`;
          
          const sent = await generateAndSend(lead, triggerInstruction, 'SALE_FOLLOWUP');
          if (sent) {
              await supabaseClient.from('leads').update({ followup_stage: nextStage, last_message_at: now.toISOString() }).eq('id', lead.id);
              results.push({ lead: lead.nombre, stage: nextStage });
          }
       }
    }

    // ==========================================
    // FLUJO 2: REACTIVACIÓN (LOW/MED INTENT)
    // ==========================================
    const { data: coldLeads } = await supabaseClient
      .from('leads').select('*').neq('buying_intent', 'ALTO').neq('buying_intent', 'COMPRADO').neq('ai_paused', true).eq('followup_stage', 0).limit(5);

    for (const lead of (coldLeads || [])) {
        const lastInteraction = new Date(lead.last_message_at || lead.created_at); 
        const diffHours = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);

        if (diffHours >= engagementDelayHours) {
            // El Trigger inyecta la instrucción invisible para Reactivación
            const triggerInstruction = `[INSTRUCCIÓN DE SISTEMA]: El cliente dejó de responder la conversación hace ${Math.round(diffHours)} horas. Ejecuta estrictamente el protocolo de REACTIVACIÓN definido en tu [ESTRATEGIA DE CIERRE Y FASES]. Escribe solo el mensaje final que le enviarás de forma natural, amigable y sin parecer un robot automático. Si le enviamos un póster, pregúntale si le quedó alguna duda sobre ese evento.`;
            
            const sent = await generateAndSend(lead, triggerInstruction, 'ENGAGEMENT');
            if (sent) {
                await supabaseClient.from('leads').update({ followup_stage: 1, last_message_at: now.toISOString() }).eq('id', lead.id);
                reactivated.push({ lead: lead.id });
            }
        }
    }

    return new Response(JSON.stringify({ success: true, processed: results, reactivated: reactivated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})