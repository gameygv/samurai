import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { client_message, lead_id, kommo_id, phone, name } = await req.json();
    if (!client_message) throw new Error("El parámetro 'client_message' es requerido.");

    // --- 1. IDENTIFICAR O CREAR LEAD ---
    let lead = null;
    if (lead_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
        lead = data;
    } 
    if (!lead && kommo_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('kommo_id', kommo_id).single();
        lead = data;
    }
    const rawPhone = phone ? phone.toString() : null;
    const cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '') : null;
    if (!lead && cleanPhone) {
        const { data } = await supabaseClient.from('leads').select('*').or(`telefono.ilike.%${cleanPhone}%`).limit(1).maybeSingle();
        lead = data;
    }
    if (!lead && (cleanPhone || kommo_id)) {
        const { data: newLead } = await supabaseClient.from('leads').insert({
            nombre: name || 'Nuevo Lead WhatsApp',
            telefono: rawPhone,
            kommo_id: kommo_id || null,
        }).select().single();
        lead = newLead;
    }
    if (!lead) throw new Error("No se pudo identificar ni crear el lead (Datos insuficientes).");

    // --- 2. CONSTRUIR CEREBRO DINÁMICO ---
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const p = (key: string) => configs?.find(c => c.key === key)?.value || "";
    const { data: webContent } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const truthBlock = webContent?.map(w => `[FUENTE OFICIAL: ${w.title}]\n${w.content}`).join('\n\n') || "ERROR: No hay Verdad Maestra indexada.";
    const { data: ciaRules } = await supabaseClient.from('errores_ia').select('categoria, correccion_sugerida').eq('estado_correccion', 'VALIDADA');
    const ciaBlock = ciaRules?.map(r => `[#CIA - REGLA ${r.categoria}]: ${r.correccion_sugerida}`).join('\n') || "No hay reglas de aprendizaje activas.";

    const systemPrompt = `# IDENTIDAD MAESTRA: SAMURAI (The Elephant Bowl)\n${p('prompt_adn_core')}\n\n# ESTRATEGIA DE CONVERSIÓN\n${p('prompt_estrategia_cierre')}\n\n# PROTOCOLOS DE CONDUCTA\n${p('prompt_protocolos')}\n\n# REGLAS DE APRENDIZAJE (#CIA)\n${ciaBlock}\n\n# FUENTE DE VERDAD ABSOLUTA (CONTEXTO DEL SITIO WEB)\n${truthBlock}\n\n# REGLA DE ORO\nBajo ninguna circunstancia respondas sobre temas ajenos a The Elephant Bowl.`;

    // --- 3. OBTENER HISTORIAL DE CONVERSACIÓN ---
    const { data: history } = await supabaseClient.from('conversaciones').select('emisor, mensaje').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(10);
    const conversationHistory = history?.reverse().map(h => ({
        role: h.emisor === 'CLIENTE' ? 'user' : 'assistant',
        content: h.mensaje
    })) || [];

    // --- 4. LLAMAR A OPENAI ---
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) throw new Error("OPENAI_API_KEY no está configurada.");

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
       method: "POST",
       headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
       body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
             { role: "system", content: systemPrompt },
             ...conversationHistory,
             { role: "user", content: client_message }
          ],
          temperature: 0.2
       })
    });
    if (!aiResponse.ok) throw new Error(`OpenAI API Error: ${await aiResponse.text()}`);
    const aiData = await aiResponse.json();
    const ai_generated_text = aiData.choices?.[0]?.message?.content || "La IA no generó una respuesta.";

    // --- 5. PROCESAR Y GUARDAR RESPUESTA ---
    let cleanText = ai_generated_text.split('---SYSTEM_ANALYSIS---')[0].trim();
    
    // Guardar mensaje del cliente
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'CLIENTE', mensaje: client_message, platform: 'API' });
    // Guardar respuesta de la IA
    await supabaseClient.from('conversaciones').insert({ lead_id: lead.id, emisor: 'SAMURAI', mensaje: cleanText, platform: 'API' });
    // Actualizar lead
    await supabaseClient.from('leads').update({ last_message_at: new Date().toISOString() }).eq('id', lead.id);

    return new Response(JSON.stringify({ success: true, reply: cleanText, lead_id: lead.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error("[process-samurai-response] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})