// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  console.log("[process-followups] Iniciando ciclo AI-Driven (Exploración & Ventas)...");

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. OBTENER CONFIGURACIÓN GENERAL Y HORARIOS
    const { data: fConfigData } = await supabaseClient.from('followup_config').select('*').limit(1).maybeSingle();
    const fConfig = fConfigData || { enabled: false };

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key) => configs?.find(c => c.key === key)?.value || null;

    const sEnabled = getConfig('sales_followup_enabled') === 'true';
    
    if (!fConfig.enabled && !sEnabled) {
        return new Response(JSON.stringify({ success: true, message: "Todos los retargeting desactivados." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar Horario Comercial
    const now = new Date();
    const mxHour = (now.getUTCHours() - 6 + 24) % 24; 
    if (mxHour < (fConfig.start_hour || 9) || mxHour >= (fConfig.end_hour || 20)) {
        return new Response(JSON.stringify({ success: true, message: `Fuera de horario laboral. Hora actual: ${mxHour}h` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const evolutionApiUrl = getConfig('evolution_api_url');
    const evolutionApiKey = getConfig('evolution_api_key');
    const openAiKey = getConfig('openai_api_key');

    if (!openAiKey) throw new Error("Falta OpenAI API Key.");

    // MATRIZ DE TIEMPOS EXPLORACIÓN
    const normalDelays = { 1: fConfig.stage_1_delay || 15, 2: fConfig.stage_2_delay || 60, 3: fConfig.stage_3_delay || 1440 };
    const normalMsgs = { 1: fConfig.stage_1_message, 2: fConfig.stage_2_message, 3: fConfig.stage_3_message };

    // MATRIZ DE TIEMPOS VENTAS (CIERRE)
    const salesDelays = { 
        1: parseInt(getConfig('sales_stage_1_delay')) || 60, 
        2: parseInt(getConfig('sales_stage_2_delay')) || 1440, 
        3: parseInt(getConfig('sales_stage_3_delay')) || 2880 
    };
    const salesMsgs = { 
        1: getConfig('sales_stage_1_message'), 
        2: getConfig('sales_stage_2_message'), 
        3: getConfig('sales_stage_3_message') 
    };

    const results = [];

    // Helper de Generación y Envío
    const generateAndSend = async (lead, triggerInstruction) => {
        try {
            const { data: kernelData } = await supabaseClient.functions.invoke('get-samurai-context', { body: { lead } });
            const { data: history } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(10);
            const historyMsgs = history ? history.reverse() : [];

            const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: kernelData?.system_prompt },
                        ...historyMsgs.map(m => ({ role: (m.emisor === 'IA' || m.emisor === 'SAMURAI') ? 'assistant' : 'user', content: m.mensaje })),
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
            const mediaUrl = mediaMatch ? mediaMatch[1].trim() : null;
            let textToSend = rawAnswer.replace(mediaRegex, '').trim();

            if (!textToSend && !mediaUrl) return false;

            if (evolutionApiUrl && evolutionApiKey) {
                const endpoint = mediaUrl ? evolutionApiUrl.replace('sendText', 'sendMedia') : evolutionApiUrl;
                const payload = mediaUrl ? {
                    number: lead.telefono,
                    mediatype: "image",
                    media: mediaUrl,
                    caption: textToSend || "",
                    mediaMessage: { mediatype: "image", media: mediaUrl, caption: textToSend || "" },
                    delay: 1500
                } : {
                    number: lead.telefono,
                    text: textToSend,
                    delay: 1500,
                    linkPreview: true
                };

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    console.error("[process-followups] Evolution Error");
                    return false;
                }
            }

            await supabaseClient.from('conversaciones').insert({ 
                lead_id: lead.id, emisor: 'SAMURAI', 
                mensaje: mediaUrl ? `[IMG: ${mediaUrl}] ${textToSend}` : textToSend, 
                platform: 'AUTO_FOLLOWUP' 
            });

            return true;
        } catch (e) {
            console.error(`[process-followups] Error en ${lead.id}:`, e);
            return false;
        }
    };

    // BUSCAR LEADS ELEGIBLES (Ni comprados, ni con pago validado, ni pausados)
    const { data: eligibleLeads } = await supabaseClient
      .from('leads')
      .select('*')
      .eq('ai_paused', false)
      .neq('buying_intent', 'COMPRADO')
      .neq('payment_status', 'VALID')
      .lt('followup_stage', 3);

    for (const lead of (eligibleLeads || [])) {
       // Determinar Modo Operativo
       const isSalesMode = lead.buying_intent === 'ALTO';
       
       if (isSalesMode && !sEnabled) continue; // Si es cierre y ventas está apagado, salta
       if (!isSalesMode && !fConfig.enabled) continue; // Si es expl y normal está apagado, salta

       const delaysToUse = isSalesMode ? salesDelays : normalDelays;
       const msgsToUse = isSalesMode ? salesMsgs : normalMsgs;

       const lastInteraction = new Date(lead.last_message_at || lead.created_at); 
       const diffMinutes = (now.getTime() - lastInteraction.getTime()) / 60000;
       const nextStage = (lead.followup_stage || 0) + 1;

       if (delaysToUse[nextStage] && diffMinutes >= delaysToUse[nextStage]) {
          const contextType = isSalesMode ? 'CIERRE DE VENTAS' : 'RE-ENGANCHE';
          console.log(`[process-followups] Lead ${lead.telefono} | Modo: ${contextType} | FASE ${nextStage} (${Math.round(diffMinutes)} mins)`);
          
          const triggerInstruction = `[INSTRUCCIÓN INVISIBLE: RETARGETING AUTOMÁTICO FASE ${nextStage} - ${contextType}]: El cliente lleva ${Math.round(diffMinutes)} minutos sin responder. 
Ejecuta ESTRICTAMENTE esta instrucción: "${msgsToUse[nextStage]}". 
Escribe SOLAMENTE el mensaje que le enviarás, mantén tu tono humano, corto y amigable. NO repitas cosas que ya le dijiste.`;
          
          const sent = await generateAndSend(lead, triggerInstruction);
          
          if (sent) {
              await supabaseClient.from('leads').update({ 
                  followup_stage: nextStage, 
                  last_message_at: now.toISOString() 
              }).eq('id', lead.id);
              results.push({ lead: lead.telefono, stage: nextStage, mode: contextType });
          }
       }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})