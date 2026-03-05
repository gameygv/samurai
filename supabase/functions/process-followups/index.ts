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

    // 1. OBTENER CONFIGURACIÓN DE FOLLOW-UPS
    const { data: fConfigData } = await supabaseClient.from('followup_config').select('*').limit(1).maybeSingle();
    const fConfig = fConfigData || { enabled: false };

    if (!fConfig.enabled) {
        console.log("[process-followups] Sistema desactivado en Panel.");
        return new Response(JSON.stringify({ success: true, message: "Retargeting desactivado en Ajustes." }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Verificar Horario Comercial (Aprox CDMX UTC-6)
    const now = new Date();
    const mxHour = (now.getUTCHours() - 6 + 24) % 24; 
    if (mxHour < (fConfig.start_hour || 9) || mxHour >= (fConfig.end_hour || 20)) {
        console.log(`[process-followups] Fuera de horario laboral (${mxHour}h).`);
        return new Response(JSON.stringify({ success: true, message: `Fuera de horario. Hora actual: ${mxHour}h` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key) => configs?.find(c => c.key === key)?.value || null;
    
    const evolutionApiUrl = getConfig('evolution_api_url');
    const evolutionApiKey = getConfig('evolution_api_key');
    const openAiKey = getConfig('openai_api_key');

    if (!openAiKey) throw new Error("Falta OpenAI API Key.");

    // MATRIZ DE TIEMPOS (EN MINUTOS)
    const delays = {
       1: fConfig.stage_1_delay || 15, 
       2: fConfig.stage_2_delay || 60, 
       3: fConfig.stage_3_delay || 1440
    };

    const stageInstructions = {
       1: fConfig.stage_1_message || "Haz un saludo sutil y pregúntale si pudo ver la información.",
       2: fConfig.stage_2_message || "Dile que sigues al pendiente por si tiene alguna duda.",
       3: fConfig.stage_3_message || "Haz un último intento de cierre, ofrécele ayuda con el pago."
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

    // ==========================================
    // BUSCAR LEADS ELEGIBLES
    // ==========================================
    const { data: eligibleLeads } = await supabaseClient
      .from('leads')
      .select('*')
      .eq('ai_paused', false)
      .neq('buying_intent', 'COMPRADO')
      .lt('followup_stage', fConfig.max_followup_stage || 3);

    for (const lead of (eligibleLeads || [])) {
       const lastInteraction = new Date(lead.last_message_at || lead.created_at); 
       const diffMinutes = (now.getTime() - lastInteraction.getTime()) / 60000;
       const nextStage = (lead.followup_stage || 0) + 1;

       // Si han pasado los minutos exactos necesarios para la SIGUIENTE etapa
       if (delays[nextStage] && diffMinutes >= delays[nextStage]) {
          console.log(`[process-followups] Lead ${lead.telefono} califica para FASE ${nextStage} (${Math.round(diffMinutes)} mins pasados)`);
          
          const triggerInstruction = `[INSTRUCCIÓN INVISIBLE: RETARGETING AUTOMÁTICO FASE ${nextStage}]: El cliente lleva ${Math.round(diffMinutes)} minutos sin responder. 
Ejecuta ESTRICTAMENTE esta instrucción: "${stageInstructions[nextStage]}". 
Escribe SOLAMENTE el mensaje que le enviarás, mantén tu tono humano, corto y amigable. NO repitas cosas que ya le dijiste en los mensajes de arriba.`;
          
          const sent = await generateAndSend(lead, triggerInstruction);
          
          if (sent) {
              await supabaseClient.from('leads').update({ 
                  followup_stage: nextStage, 
                  last_message_at: now.toISOString() // Resetea el reloj para la siguiente fase
              }).eq('id', lead.id);
              results.push({ lead: lead.telefono, stage: nextStage });
          }
       }
    }

    return new Response(JSON.stringify({ success: true, processed: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})