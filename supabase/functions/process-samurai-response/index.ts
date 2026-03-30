// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

  const logTrace = async (msg: string, isError = false) => {
    await supabaseClient.from('activity_logs').insert({
        action: isError ? 'ERROR' : 'UPDATE', resource: 'BRAIN',
        description: `Samurai Trace: ${msg}`, status: isError ? 'ERROR' : 'OK'
    });
  };

  try {
    const body = await req.json().catch(() => ({}));
    const lead_id = body.lead_id;
    const clientMessage = body.client_message || '';

    if (!lead_id) {
        await logTrace("Abortado: No se recibió lead_id", true);
        return new Response('no_lead_id', { headers: corsHeaders });
    }

    const { data: lead, error: leadErr } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
    if (leadErr || !lead) {
        await logTrace(`Abortado: Lead no encontrado (${lead_id})`, true);
        return new Response('lead_not_found', { headers: corsHeaders });
    }

    if (lead.ai_paused) return new Response('skipped_pause', { headers: corsHeaders });
    if (lead.buying_intent === 'COMPRADO' || lead.buying_intent === 'PERDIDO') return new Response('skipped_stage', { headers: corsHeaders });

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string, def = "") => configs?.find((c: any) => c.key === key)?.value || def;
    const openaiKey = getConfig('openai_api_key');

    if (!openaiKey) {
        await logTrace("Abortado: OpenAI API Key faltante.", true);
        return new Response('missing_key', { headers: corsHeaders });
    }

    await logTrace(`Construyendo contexto del sistema localmente para ${lead.nombre}...`);
    
    // FETCH CONTEXT IN PARALLEL FOR SPEED (Optimización de 2 segundos)
    const [
        { data: webPages },
        { data: kbDocs },
        { data: mediaAssets },
        { data: history }
    ] = await Promise.all([
        supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success'),
        supabaseClient.from('knowledge_documents').select('title, category, content'),
        supabaseClient.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER'),
        supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(15)
    ]);

    let masterTruth = "\n=== VERDAD MAESTRA (SITIO WEB) ===\n";
    webPages?.forEach(p => { if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 1500)}\n`; });

    let kbContext = "\n=== CONOCIMIENTO TÉCNICO ===\n";
    kbDocs?.forEach(d => { if(d.content) kbContext += `\n[RECURSO: ${d.title}]\n${d.content.substring(0, 1000)}\n`; });

    let mediaContext = "\n=== BÓVEDA VISUAL (POSTERS) ===\nUsa <<MEDIA:url>> para enviar posters.\n";
    mediaAssets?.forEach(m => { mediaContext += `- ${m.title}: ${m.ai_instructions} -> <<MEDIA:${m.url}>>\n`; });

    let wcContext = "";
    let bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;
    let autoCloseEnabled = true;
    let agentName = "un asesor";

    if (lead.assigned_to) {
        const { data: agentData } = await supabaseClient.from('profiles').select('full_name').eq('id', lead.assigned_to).maybeSingle();
        if (agentData?.full_name) agentName = agentData.full_name.split(' ')[0];
        
        const closingConfigRaw = getConfig(`agent_closing_${lead.assigned_to}`);
        if (closingConfigRaw) {
            try { if (JSON.parse(closingConfigRaw).auto_close === false) autoCloseEnabled = false; } catch(e) {}
        }
        
        const agentBankRaw = getConfig(`agent_bank_${lead.assigned_to}`);
        if (agentBankRaw) {
            try {
                const agentBank = JSON.parse(agentBankRaw);
                if (agentBank.enabled) bankInfo = `Banco: ${agentBank.bank_name}\nCuenta: ${agentBank.bank_account}\nCLABE: ${agentBank.bank_clabe}\nTitular: ${agentBank.bank_holder}`;
            } catch(e) {}
        }
    }

    if (autoCloseEnabled) {
        const wcProductsRaw = getConfig('wc_products');
        if (wcProductsRaw) {
            try {
                const wcProducts = JSON.parse(wcProductsRaw);
                const wcUrl = getConfig('wc_url', '').replace(/\/$/, '');
                let wcCheckout = getConfig('wc_checkout_path', '/checkout/');
                if (!wcCheckout.startsWith('/')) wcCheckout = '/' + wcCheckout;
                
                if (wcProducts.length > 0) {
                    wcContext = "\n=== CATÁLOGO DE PRODUCTOS ===\n";
                    wcProducts.forEach(p => {
                        const link = `${wcUrl}${wcCheckout}?add-to-cart=${p.wc_id}`;
                        wcContext += `- PRODUCTO: ${p.title}\n  PRECIO: $${p.price}\n  LINK DE COMPRA: ${link}\n  REGLA DE VENTA: ${p.prompt}\n\n`;
                    });
                }
            } catch (e) {}
        }
    } else {
        wcContext = "\n=== CATÁLOGO DE PRODUCTOS ===\n(PRECIOS NO DISPONIBLES. EL HUMANO LOS DARÁ.)\n";
        bankInfo = "NO DISPONIBLE - EL HUMANO PROPORCIONARÁ LA CUENTA.";
    }

    const activeLeadMemory = `
=== ESTADO ACTUAL ===
Nombre: ${lead.nombre && !lead.nombre.includes('Nuevo') ? lead.nombre : 'NO PROPORCIONADO'}
Email: ${lead.email || 'NO PROPORCIONADO'}
Ciudad: ${lead.ciudad || 'NO PROPORCIONADA'}

REGLAS DE MEMORIA:
1. SI EL EMAIL O LA CIUDAD YA ESTÁN CAPTURADOS, NO VUELVAS A PEDIRLOS.
2. Si el cliente dice "ya pagué", NUNCA valides el pago tú. Di que lo verificarán en breve.
    `;

    const systemPrompt = `
${activeLeadMemory}

${getConfig('prompt_alma_samurai')}
${getConfig('prompt_adn_core')}
${getConfig('prompt_estrategia_cierre')}
${getConfig('prompt_behavior_rules')}
${getConfig('prompt_relearning')}

${masterTruth}
${kbContext}
${mediaContext}
${wcContext}

=== DATOS BANCARIOS ===
${bankInfo}
`;

    const msgs = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map(h => ({ role: (['IA', 'SAMURAI', 'BOT'].includes(h.emisor)) ? 'assistant' : 'user', content: h.mensaje })),
        { role: 'user', content: clientMessage }
    ];

    await logTrace("Llamando al cerebro de OpenAI (GPT-4o)...");
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: "gpt-4o", messages: msgs, temperature: 0.5 })
    });

    if (!aiRes.ok) {
        const errText = await aiRes.text();
        await logTrace(`Fallo en OpenAI: ${aiRes.status} - ${errText}`, true);
        return new Response('openai_error', { headers: corsHeaders });
    }

    const aiData = await aiRes.json();
    const aiText = aiData.choices?.[0]?.message?.content || '';

    if (aiText) {
        await logTrace("Respuesta lista. Despachando a WhatsApp...");
        const sendRes = await supabaseClient.functions.invoke('send-message-v3', { 
            body: { channel_id: lead.channel_id, phone: lead.telefono, message: aiText, lead_id: lead.id } 
        });

        if (sendRes.error || (sendRes.data && !sendRes.data.success)) {
            await logTrace(`Fallo de entrega Meta/Gowa: ${JSON.stringify(sendRes.data?.error || sendRes.error)}`, true);
        } else {
            await supabaseClient.from('conversaciones').insert({ 
                lead_id: lead.id, emisor: 'IA', mensaje: aiText, platform: 'WHATSAPP'
            });
            await logTrace("✅ Mensaje entregado y guardado exitosamente.");
        }
    } else {
        await logTrace("La IA generó una respuesta vacía.", true);
    }

    return new Response('ok', { headers: corsHeaders });
  } catch (err: any) {
    await logTrace(`Excepción de código: ${err.message}`, true);
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
});