// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { lead_id, force } = await req.json().catch(() => ({}));
    if (!lead_id) throw new Error("ID de Lead requerido.");

    // 1. Obtener API Key
    const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'openai_api_key').single();
    if (!config?.value) throw new Error("OpenAI API Key no configurada.");

    // 2. Obtener Historial
    const { data: messages } = await supabaseClient
        .from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead_id)
        .order('created_at', { ascending: true }) 
        .limit(50);

    if (!messages || messages.length === 0) throw new Error("No hay mensajes para analizar.");

    const transcript = messages.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n');

    // 3. Prompt de Extracción Rígido
    const prompt = `
        ERES UN ROBOT DE EXTRACCIÓN DE DATOS.
        LEE ESTE CHAT Y EXTRAE LA INFORMACIÓN SOLICITADA.

        CHAT:
        ${transcript}

        REGLAS:
        1. EMAIL: Busca cualquier @. Ejemplo: "usuario@gmail.com".
        2. CIUDAD: Extrae la ubicación mencionada.
        3. NOMBRE: El nombre del cliente.
        4. INTENT: BAJO (solo pregunta), MEDIO (interés real), ALTO (pidió pago/cuenta).

        RESPONDE EXCLUSIVAMENTE EN ESTE FORMATO JSON:
        {
            "email": "correo@test.com",
            "ciudad": "Nombre de la Ciudad",
            "nombre": "Nombre del Cliente",
            "intent": "ALTO",
            "summary": "Breve resumen",
            "psych": "Perfil psicográfico"
        }
    `;

    const response = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.value}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "system", content: "Responde solo JSON válido sin markdown." }, { role: "user", content: prompt }],
            temperature: 0
        })
    });

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0]?.message?.content || '{}');

    // 4. ACTUALIZACIÓN FORZOSA (FORCE UPDATE)
    const updatePayload: any = {
        last_analyzed_at: new Date().toISOString()
    };

    // Si la IA encontró algo, lo pisamos en la DB sin preguntar
    if (result.email && result.email.includes('@')) updatePayload.email = result.email.trim();
    if (result.ciudad) updatePayload.ciudad = result.ciudad.trim();
    if (result.nombre && result.nombre.length > 2) updatePayload.nombre = result.nombre.trim();
    if (result.intent) updatePayload.buying_intent = result.intent;
    if (result.summary) updatePayload.summary = result.summary;
    if (result.psych) updatePayload.perfil_psicologico = result.psych;

    const { data: updatedLead, error: updateError } = await supabaseClient
        .from('leads')
        .update(updatePayload)
        .eq('id', lead_id)
        .select()
        .single();

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ 
        success: true, 
        status: 'updated', 
        extracted: result,
        lead: updatedLead // Enviamos el objeto actualizado de vuelta
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})