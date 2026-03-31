// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const body = await req.json().catch(() => ({}));
    const lead = body.lead || {};
    const platform = body.platform || 'WHATSAPP';

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string, def = "") => configs?.find((c: any) => c.key === key)?.value || def;

    // --- CARGAR VERDAD MAESTRA ---
    const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    let masterTruth = "\n=== VERDAD MAESTRA (SITIO WEB) ===\n";
    webPages?.forEach(p => { if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 1500)}\n`; });

    // --- CARGAR BASE DE CONOCIMIENTO ---
    const { data: kbDocs } = await supabaseClient.from('knowledge_documents').select('title, category, content');
    let kbContext = "\n=== CONOCIMIENTO TÉCNICO (PDFs/NOTAS) ===\n";
    kbDocs?.forEach(d => { if(d.content) kbContext += `\n[RECURSO: ${d.title}]\n${d.content.substring(0, 1000)}\n`; });

    // --- CARGAR BÓVEDA VISUAL (POSTERS) — filtrar expirados por valid_until ---
    const today = new Date().toISOString().split('T')[0];
    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, url, ai_instructions').eq('category', 'POSTER').or(`valid_until.is.null,valid_until.gte.${today}`);
    let mediaContext = "\n=== BÓVEDA VISUAL (POSTERS) ===\nINSTRUCCIÓN CRÍTICA: Para enviar un poster usa EXACTAMENTE este formato en tu respuesta: <<MEDIA:url_del_poster>>\n";
    mediaAssets?.forEach(m => { mediaContext += `- ${m.title}: ${m.ai_instructions} -> <<MEDIA:${m.url}>>\n`; });

    // --- EVALUAR CONFIGURACIÓN DE CIERRE Y AGENTE ---
    let autoCloseEnabled = true;
    let agentName = "un asesor";
    
    if (lead.assigned_to) {
        // Obtener nombre del agente
        const { data: agentData } = await supabaseClient.from('profiles').select('full_name').eq('id', lead.assigned_to).maybeSingle();
        if (agentData?.full_name) agentName = agentData.full_name.split(' ')[0]; // Solo el primer nombre

        // Verificar si el agente apagó el cierre automático
        const closingConfigRaw = getConfig(`agent_closing_${lead.assigned_to}`);
        if (closingConfigRaw) {
            try {
                const closingConfig = JSON.parse(closingConfigRaw);
                if (closingConfig.auto_close === false) autoCloseEnabled = false;
            } catch(e) {}
        }
    }

    // --- CARGAR WOOCOMMERCE & BANCOS (SOLO SI EL CIERRE AUTOMÁTICO ESTÁ ACTIVO) ---
    let wcContext = "";
    let bankInfo = "";
    let handoffRule = "";

    if (autoCloseEnabled) {
        const wcProductsRaw = getConfig('wc_products');
        if (wcProductsRaw) {
            try {
                const wcProducts = JSON.parse(wcProductsRaw);
                const wcUrl = getConfig('wc_url', '').replace(/\/$/, '');
                let wcCheckout = getConfig('wc_checkout_path', '/checkout/');
                if (!wcCheckout.startsWith('/')) wcCheckout = '/' + wcCheckout;

                if (wcProducts.length > 0) {
                    wcContext = "\n=== CATÁLOGO DE PRODUCTOS (TIENDA ONLINE WOOCOMMERCE) ===\n";
                    wcProducts.forEach(p => {
                        const link = `${wcUrl}${wcCheckout}?add-to-cart=${p.wc_id}`;
                        wcContext += `- PRODUCTO: ${p.title}\n  PRECIO: $${p.price}\n  LINK DE COMPRA: ${link}\n  REGLA DE VENTA E INSTRUCCIÓN IA: ${p.prompt}\n\n`;
                    });
                }
            } catch (e) {}
        }

        bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;
        
        if (lead.assigned_to) {
            const agentBankRaw = getConfig(`agent_bank_${lead.assigned_to}`);
            if (agentBankRaw) {
                try {
                    const agentBank = JSON.parse(agentBankRaw);
                    if (agentBank.enabled) {
                        bankInfo = `Banco: ${agentBank.bank_name}\nCuenta: ${agentBank.bank_account}\nCLABE: ${agentBank.bank_clabe}\nTitular: ${agentBank.bank_holder}`;
                    }
                } catch(e) {}
            }
        }
    } else {
        // SI EL CIERRE MANUAL ESTÁ ACTIVADO (Auto-Close Off)
        wcContext = "\n=== CATÁLOGO DE PRODUCTOS ===\n(PRECIOS Y LINKS NO DISPONIBLES. EL HUMANO LOS PROPORCIONARÁ.)\n";
        bankInfo = "NO DISPONIBLE - EL HUMANO PROPORCIONARÁ LA CUENTA.";
        
        handoffRule = `
### REGLA ESTRICTA DE CIERRE MANUAL (HANDOFF A HUMANO):
El asesor humano (${agentName}) ha decidido cerrar las ventas personalmente.
CUANDO EL CLIENTE MUESTRE INTENCIÓN DE COMPRA, PREGUNTE POR PRECIOS FINALES, MÉTODOS DE PAGO O DEPÓSITOS:
1. NO ofrezcas ni menciones cuentas bancarias.
2. NO proporciones enlaces de compra.
3. DETÉN el proceso de venta y responde exactamente algo similar a esto:
   "¡Excelente! En breve mi compañero(a) ${agentName} te contactará personalmente por aquí para brindarte los detalles de pago y ayudarte a completar tu registro."
`;
    }

    // AQUI ESTÁ LA PROTECCIÓN CRÍTICA PARA DATOS Y PAGOS
    const activeLeadMemory = `
=== ESTADO ACTUAL DEL PROSPECTO (MEMORIA) ===
Nombre conocido: ${lead.nombre && !lead.nombre.includes('Nuevo') ? lead.nombre : 'NO PROPORCIONADO'}
Email capturado: ${lead.email || 'NO PROPORCIONADO'}
Ciudad: ${lead.ciudad || 'NO PROPORCIONADA'}

REGLAS ESTRICTAS DE MEMORIA Y VENTAS:
1. SI EL EMAIL O LA CIUDAD YA ESTÁN CAPTURADOS, NO VUELVAS A PEDIRLOS BAJO NINGUNA CIRCUNSTANCIA.
2. PAGOS: Si el cliente dice "ya pagué", "listo" o envía una imagen de comprobante, NUNCA le confirmes que el pago está validado o completo. Tu respuesta DEBE SER SIEMPRE: "¡Excelente! He recibido tu confirmación. En breve nuestro sistema automático o un asesor verificará el comprobante y validará tu acceso."
`;

    const voiceInstruction = `
### REGLA DE OJO DE HALCÓN (AUDICIÓN):
1. Cuentas con un módulo de transcripción avanzada (OpenAI Whisper). 
2. Si ves un mensaje que empieza con "[TRANSCRIPCIÓN DE NOTA DE VOZ]:", significa que el cliente te envió un audio y ya fue procesado para ti. 
3. RESPONDE como si hubieras escuchado el audio perfectamente.
`;

    const systemPrompt = `
${voiceInstruction}
${activeLeadMemory}
${handoffRule}

${getConfig('prompt_alma_samurai')}
${getConfig('prompt_adn_core')}
${getConfig('prompt_estrategia_cierre')}
${getConfig('prompt_behavior_rules')}

${getConfig('prompt_relearning')}

${masterTruth}
${kbContext}
${mediaContext}
${wcContext}

=== DATOS DE PAGO BANCARIO ===
${bankInfo}
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})