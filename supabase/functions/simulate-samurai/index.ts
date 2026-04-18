// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const { question, history, customPrompts } = await req.json();

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string, def = "") => configs?.find(c => c.key === key)?.value || def;

    const apiKey = Deno.env.get('OPENAI_API_KEY') || getConfig('openai_api_key');
    if (!apiKey) throw new Error("OpenAI API Key no encontrada.");

    const today = new Date().toISOString().split('T')[0];

    // --- VERDAD MAESTRA ---
    const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    let masterTruth = `\n=== VERDAD MAESTRA (SITIO WEB) ===\nIMPORTANTE: La fecha de hoy es ${today}. NUNCA recomiendes talleres, cursos o eventos con fechas anteriores a hoy.\n`;
    webPages?.forEach(p => { if(p.content) masterTruth += `\n[PÁGINA: ${p.title}]\n${p.content.substring(0, 1500)}\n`; });

    // --- BASE DE CONOCIMIENTO ---
    const { data: kbDocs } = await supabaseClient.from('knowledge_documents').select('title, category, content').or(`valid_until.is.null,valid_until.gte.${today}`);
    let kbContext = "\n=== CONOCIMIENTO TÉCNICO (PDFs/NOTAS) ===\n";
    kbDocs?.forEach(d => { if(d.content) kbContext += `\n[RECURSO: ${d.title}]\n${d.content.substring(0, 1000)}\n`; });

    // --- BÓVEDA VISUAL ---
    const { data: mediaAssets } = await supabaseClient.from('media_assets').select('title, description, url, ai_instructions, ocr_content, start_date, valid_until, category').in('category', ['GENERAL', 'PROMOCION', 'AVISO']).or(`valid_until.is.null,valid_until.gte.${today}`);
    let mediaContext = "\n=== BÓVEDA VISUAL (MEDIA) ===\nINSTRUCCIÓN CRÍTICA: Para enviar una imagen usa EXACTAMENTE este formato en tu respuesta: <<MEDIA:url_de_imagen>>\n";
    mediaAssets?.forEach(m => {
      if (m.category === 'PROMOCION' && m.start_date && m.start_date > today) return;
      let meta = `- [${m.category}] ${m.title}: ${m.ai_instructions || 'Sin instrucciones'} -> <<MEDIA:${m.url}>>`;
      if (m.description) meta += ` | Descripción: ${m.description.substring(0, 200)}`;
      if (m.valid_until) meta += ` | Vigente hasta: ${m.valid_until}`;
      if (m.start_date) meta += ` | Inicio: ${m.start_date}`;
      mediaContext += meta + '\n';
      if (m.ocr_content) mediaContext += `  DETALLE: ${m.ocr_content.substring(0, 500)}\n`;
    });

    // --- CATÁLOGO DE CURSOS Y TALLERES ---
    const { data: courses } = await supabaseClient.from('courses').select('*').eq('ai_enabled', true).or(`valid_until.is.null,valid_until.gte.${today}`);
    let coursesContext = "\n=== CATÁLOGO DE CURSOS Y TALLERES ===\nINSTRUCCIÓN: Para enviar el poster de un curso usa <<MEDIA:url_del_poster>>. Ofrece cursos activos basándote en las fechas y precios. Si la preventa está vigente, menciona el precio de preventa y la urgencia. Si sale_closes_at ya pasó, NO ofrezcas ese curso.\n";
    courses?.forEach(c => {
      if (c.sale_closes_at && c.sale_closes_at < today) return;
      let meta = `- CURSO: ${c.title}`;
      if (c.description) meta += ` | ${c.description.substring(0, 200)}`;
      meta += ` -> <<MEDIA:${c.poster_url}>>`;
      if (c.sede) meta += ` | Sede: ${c.sede}`;
      if (c.nivel) meta += ` | Nivel: ${c.nivel}`;
      if (c.profesor) meta += ` | Profesor: ${c.profesor}`;
      if (c.presale_price && c.presale_ends_at && c.presale_ends_at >= today) {
        meta += ` | PREVENTA: $${c.presale_price} (hasta ${c.presale_ends_at}). Anticipo de $1500 disponible.`;
      } else if (c.normal_price) {
        meta += ` | Precio: $${c.normal_price}`;
      }
      if (c.sale_closes_at) meta += ` | Cierre de venta: ${c.sale_closes_at}`;
      if (c.extras) meta += ` | Extras: ${c.extras}`;
      if (c.session_dates && Array.isArray(c.session_dates) && c.session_dates.length > 0) {
        const sessions = c.session_dates.map(s => `${s.date} ${s.start_time || ''}-${s.end_time || ''}`).join(', ');
        meta += ` | Fechas: ${sessions}`;
      }
      if (c.ai_instructions) meta += `\n  TRIGGER: ${c.ai_instructions}`;
      coursesContext += meta + '\n';
      if (c.ocr_content) coursesContext += `  DETALLE DEL POSTER: ${c.ocr_content.substring(0, 500)}\n`;
    });

    // --- WOOCOMMERCE & BANCO ---
    let wcContext = "";
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
      } catch (_) {}
    }

    const bankInfo = `Banco: ${getConfig('bank_name')}\nCuenta: ${getConfig('bank_account')}\nCLABE: ${getConfig('bank_clabe')}\nTitular: ${getConfig('bank_holder')}`;

    const systemPrompt = `
### REGLA TEMPORAL ESTRICTA:
La fecha de hoy es ${today}. NUNCA menciones, ofrezcas ni recomiendes talleres, cursos o eventos cuya fecha ya pasó. Si el cliente pregunta por un evento pasado, responde que ese ya ocurrió y ofrécele las próximas fechas disponibles.

${customPrompts?.prompt_alma_samurai || getConfig('prompt_alma_samurai')}
${customPrompts?.prompt_adn_core || getConfig('prompt_adn_core')}
${customPrompts?.prompt_estrategia_cierre || getConfig('prompt_estrategia_cierre')}

${getConfig('prompt_behavior_rules')}
${getConfig('prompt_relearning')}

${masterTruth}
${kbContext}
${mediaContext}
${coursesContext}
${wcContext}

=== DATOS DE PAGO BANCARIO ===
${bankInfo}
`;

    const messages = [
        { role: "system", content: "Eres Sam. Al final de tu respuesta añade '---JSON---' con un objeto que tenga 'layers_used' (array de strings con las capas que usaste: ADN CORE, CURSOS, MEDIA, VERDAD MAESTRA, CONOCIMIENTO, WOOCOMMERCE, BANCO) y 'reasoning' (explicación de tu lógica)." },
        { role: "system", content: systemPrompt }
    ];

    if (history && history.length > 0) {
        history.forEach(msg => messages.push({ role: msg.role === 'bot' ? 'assistant' : 'user', content: msg.text }));
    } else {
        messages.push({ role: "user", content: question });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: "gpt-4o", messages: messages, temperature: 0.4 })
    });

    if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${await response.text()}`);
    const aiData = await response.json();
    const rawText = aiData.choices?.[0]?.message?.content || '';
    const parts = rawText.split('---JSON---');

    let explanation = { layers_used: ["ADN CORE"], reasoning: "Respuesta generada por personalidad base." };
    if (parts[1]) {
      try { explanation = JSON.parse(parts[1].trim().replace(/```json/g, '').replace(/```/g, '')); } catch (_) {}
    }
    return new Response(JSON.stringify({
        answer: parts[0].trim(),
        explanation
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
  }
})
