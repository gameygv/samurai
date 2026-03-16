// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function findValue(obj: any, keyToFind: string): any {
  if (!obj || typeof obj !== 'object') return null;
  if (keyToFind in obj) return obj[keyToFind];
  for (const key in obj) {
    const found = findValue(obj[key], keyToFind);
    if (found) return found;
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '', 
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let leadId: string | null = null;

  try {
    const body = await req.json();
    const eventName = (body.event || body.type || "").toLowerCase();
    if (eventName !== 'messages.upsert') {
      return new Response(JSON.stringify({ ignored: true }), { headers: corsHeaders });
    }

    const messageData = findValue(body, 'message'); 
    const fromMe = findValue(body, 'fromMe') || findValue(body.data?.key, 'fromMe');
    const phone = findValue(body, 'remoteJid')?.split('@')[0] || findValue(body.data?.key, 'remoteJid')?.split('@')[0];

    if (!phone || phone.includes('status') || phone.includes('broadcast')) {
      return new Response('Ignored: no phone');
    }

    let messageText = findValue(messageData, 'conversation') 
      || findValue(messageData, 'text') 
      || findValue(messageData, 'caption') 
      || "";

    // OBTENER O CREAR LEAD
    let { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .or(`telefono.ilike.%${phone}%`)
      .maybeSingle();

    if (!lead) {
      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert({ nombre: `Nuevo Lead ${phone.slice(-4)}`, telefono: phone, buying_intent: 'BAJO' })
        .select()
        .single();
      if (createError) {
        console.error("[webhook] Error creando lead:", createError);
        return new Response('Error creating lead', { status: 500 });
      }
      lead = newLead;
    }

    leadId = lead.id;

    // MENSAJES SALIENTES (fromMe)
    if (fromMe) {
      if (!messageText) return new Response('Empty fromMe');
      
      // Verificar si es eco de la IA
      const { data: recentAI } = await supabase
        .from('conversaciones')
        .select('id')
        .eq('lead_id', lead.id)
        .in('emisor', ['IA', 'SAMURAI'])
        .gte('created_at', new Date(Date.now() - 15000).toISOString())
        .limit(1);

      if (recentAI && recentAI.length > 0) {
        return new Response('AI Echo ignored');
      }

      await supabase.from('conversaciones').insert({
        lead_id: lead.id, emisor: 'HUMANO', mensaje: messageText, platform: 'WHATSAPP_MANUAL'
      });
      return new Response('Agent message saved');
    }

    // MENSAJES ENTRANTES DEL CLIENTE
    if (!messageText) messageText = "[MULTIMEDIA]";

    // GUARDAR MENSAJE DEL CLIENTE INMEDIATAMENTE
    const { error: clientMsgError } = await supabase.from('conversaciones').insert({
      lead_id: lead.id, emisor: 'CLIENTE', mensaje: messageText, platform: 'WHATSAPP'
    });
    if (clientMsgError) {
      console.error("[webhook] Error guardando mensaje cliente:", clientMsgError);
    }

    await supabase.from('leads').update({ 
      last_message_at: new Date().toISOString(), 
      followup_stage: 0 
    }).eq('id', lead.id);

    if (lead.ai_paused) {
      return new Response('AI paused');
    }

    // OBTENER CONFIGURACIÓN
    const { data: configs } = await supabase.from('app_config').select('key, value');
    const getC = (k: string) => configs?.find(c => c.key === k)?.value || '';
    const apiKey = getC('openai_api_key');

    if (!apiKey) {
      await supabase.from('conversaciones').insert({
        lead_id: lead.id, emisor: 'SAMURAI', 
        mensaje: '[ERROR: Falta OpenAI API Key en Ajustes > API Keys]', 
        platform: 'ERROR'
      });
      return new Response('No API key');
    }

    // CONSTRUIR SISTEMA DE PROMPTS
    const { data: media } = await supabase
      .from('media_assets').select('title, url, ai_instructions, ocr_content').eq('category', 'POSTER');
    const { data: web } = await supabase
      .from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const { data: kb } = await supabase
      .from('knowledge_documents').select('title, content, description');

    const pAlma = getC('prompt_alma_samurai');
    const pAdn = getC('prompt_adn_core');
    const pEstrategia = getC('prompt_estrategia_cierre');
    const pRelearning = getC('prompt_relearning');
    const bankInfo = `Banco: ${getC('bank_name')}\nCuenta: ${getC('bank_account')}\nCLABE: ${getC('bank_clabe')}\nTitular: ${getC('bank_holder')}`;

    let wcUrl = getC('wc_url') || '';
    let checkoutPath = getC('wc_checkout_path') || '/checkout/';
    let products: any[] = [];
    try { products = JSON.parse(getC('wc_products') || '[]'); } catch(e) {}

    const baseUrl = wcUrl.endsWith('/') ? wcUrl.slice(0, -1) : wcUrl;
    const path = checkoutPath.startsWith('/') ? checkoutPath : `/${checkoutPath}`;

    let catalogContext = '\n=== CATÁLOGO DE PRODUCTOS ===\n';
    products.forEach((p: any) => {
      catalogContext += `[PRODUCTO]: ${p.title} ($${p.price})\n[LINK]: ${baseUrl}${path}?add-to-cart=${p.wc_id}\n[CUÁNDO]: ${p.prompt}\n\n`;
    });

    let mediaContext = '\n=== POSTERS DISPONIBLES ===\nCuando el cliente pregunte por una ciudad o evento, adjunta el poster con <<MEDIA:URL>>.\n\n';
    if (media && media.length > 0) {
      media.forEach(m => {
        mediaContext += `- ${m.title}: ${m.ai_instructions}\n  ETIQUETA: <<MEDIA:${m.url}>>\n\n`;
      });
    }

    let masterTruth = '\n=== VERDAD MAESTRA ===\n';
    if (web && web.length > 0) {
      web.forEach(p => { if(p.content) masterTruth += `[${p.title}]: ${p.content.substring(0, 1200)}\n`; });
    }

    let kbContext = '\n=== BASE DE CONOCIMIENTO ===\n';
    if (kb && kb.length > 0) {
      kb.forEach(d => { if(d.content) kbContext += `[${d.title}]: ${d.content.substring(0, 800)}\n`; });
    }

    const ciaRules = pRelearning && pRelearning !== '# Aún no hay lecciones inyectadas.' 
      ? `\n=== REGLAS #CIA (PRIORIDAD ABSOLUTA) ===\n${pRelearning}\n` : '';

    const systemPrompt = [pAlma, pAdn, pEstrategia, ciaRules, masterTruth, kbContext, mediaContext, catalogContext, `\n=== DATOS BANCARIOS ===\n${bankInfo}`]
      .filter(Boolean).join('\n');

    // HISTORIAL DE CONVERSACIÓN
    const { data: history } = await supabase
      .from('conversaciones')
      .select('emisor, mensaje')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(20);
    const historyMsgs = history ? history.reverse() : [];

    // LLAMADA A OPENAI
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...historyMsgs.map(m => ({ 
            role: (m.emisor === 'IA' || m.emisor === 'SAMURAI' ? 'assistant' : 'user'), 
            content: m.mensaje 
          })),
          { role: "user", content: messageText }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("[webhook] OpenAI error:", errText);
      // GUARDAR ERROR COMO MENSAJE DE IA PARA QUE SEA VISIBLE
      await supabase.from('conversaciones').insert({
        lead_id: lead.id, emisor: 'SAMURAI',
        mensaje: `[ERROR OPENAI ${aiRes.status}]: ${errText.substring(0, 300)}`,
        platform: 'ERROR'
      });
      return new Response('OpenAI error saved', { status: 200, headers: corsHeaders });
    }

    const aiData = await aiRes.json();
    let rawAnswer = aiData.choices?.[0]?.message?.content || "";

    if (!rawAnswer) {
      await supabase.from('conversaciones').insert({
        lead_id: lead.id, emisor: 'SAMURAI',
        mensaje: '[IA procesó sin generar respuesta de texto]',
        platform: 'SISTEMA'
      });
      return new Response('Empty AI response saved');
    }

    // PROCESAR JSON ESPECIAL (payment_status, request_human)
    let paymentStatus = null;
    let requestHuman = false;
    if (rawAnswer.includes('---JSON---')) {
      const parts = rawAnswer.split('---JSON---');
      rawAnswer = parts[0].trim();
      try {
        const parsed = JSON.parse(parts[1].trim().replace(/```json/g, '').replace(/```/g, '').trim());
        if (parsed.payment_status) paymentStatus = parsed.payment_status;
        if (parsed.request_human) requestHuman = true;
      } catch(e) {}
    }

    // PROCESAR MEDIA
    const mediaRegex = /<<MEDIA:(.*?)>>/i;
    const mediaMatch = rawAnswer.match(mediaRegex);
    const mediaUrl = mediaMatch ? mediaMatch[1].trim() : null;
    const textToSend = rawAnswer.replace(mediaRegex, '').trim();
    const messageToLog = mediaUrl ? `[IMG: ${mediaUrl}] ${textToSend}` : textToSend;

    // ============================================================
    // GUARDADO INDESTRUCTIBLE EN BASE DE DATOS
    // Cambiado 'IA' por 'SAMURAI' para pasar el Check Constraint
    // ============================================================
    const { data: savedMsg, error: saveError } = await supabase
      .from('conversaciones')
      .insert({
        lead_id: lead.id,
        emisor: 'SAMURAI',
        mensaje: messageToLog,
        platform: 'WHATSAPP_AUTO'
      })
      .select()
      .single();

    if (saveError) {
      console.error("[webhook] ERROR CRÍTICO guardando mensaje IA:", JSON.stringify(saveError));
      // Intentar de nuevo con insert simple
      await supabase.from('conversaciones').insert({
        lead_id: lead.id, emisor: 'SAMURAI', mensaje: messageToLog, platform: 'WHATSAPP_AUTO'
      });
    } else {
      console.log("[webhook] Mensaje IA guardado exitosamente. ID:", savedMsg?.id);
    }

    // ACTUALIZAR ESTADOS
    if (paymentStatus) {
      await supabase.from('leads').update({ payment_status: paymentStatus }).eq('id', lead.id);
    }
    if (requestHuman) {
      await supabase.from('leads').update({ ai_paused: true }).eq('id', lead.id);
      await supabase.from('conversaciones').insert({
        lead_id: lead.id, emisor: 'NOTA',
        mensaje: 'IA Pausada automáticamente. Cliente solicitó atención humana.',
        platform: 'PANEL_INTERNO'
      });
    }

    // ENVIAR A WHATSAPP (después del guardado)
    const evoUrl = getC('evolution_api_url');
    const evoKey = getC('evolution_api_key');
    if (evoUrl && evoKey && (textToSend || mediaUrl)) {
      try {
        const endpoint = mediaUrl ? evoUrl.replace('sendText', 'sendMedia') : evoUrl;
        const payload = mediaUrl
          ? { number: phone, mediatype: "image", media: mediaUrl, caption: textToSend || "", mediaMessage: { mediatype: "image", media: mediaUrl, caption: textToSend || "" } }
          : { number: phone, text: textToSend };
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': evoKey },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        console.error("[webhook] Error enviando a WhatsApp:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, saved_id: savedMsg?.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error("[webhook] Error crítico:", error.message);
    // Si tenemos el leadId, guardar el error como mensaje visible
    if (leadId) {
      try {
        const supabase2 = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
        await supabase2.from('conversaciones').insert({
          lead_id: leadId, emisor: 'SAMURAI',
          mensaje: `[ERROR INTERNO WEBHOOK]: ${error.message}`,
          platform: 'ERROR'
        });
      } catch(e2) {}
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})