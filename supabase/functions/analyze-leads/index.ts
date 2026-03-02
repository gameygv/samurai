// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de pre-flight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { lead_id } = await req.json();
    if (!lead_id) throw new Error("ID de Lead no proporcionado.");

    console.log(`[analyze-leads] Iniciando análisis para Lead: ${lead_id}`);

    // 1. Obtener Configuración (API Key)
    const { data: config } = await supabaseClient.from('app_config').select('value').eq('key', 'openai_api_key').single();
    if (!config?.value) throw new Error("OpenAI API Key no encontrada en app_config.");

    // 2. Obtener Historial de Mensajes
    const { data: messages, error: msgError } = await supabaseClient
        .from('conversaciones')
        .select('emisor, mensaje')
        .eq('lead_id', lead_id)
        .order('created_at', { ascending: true }) 
        .limit(40);

    if (msgError || !messages || messages.length === 0) {
        throw new Error("No hay mensajes suficientes para analizar.");
    }

    const transcript = messages.map(m => `[${m.emisor}]: ${m.mensaje}`).join('\n');

    // 3. Petición a OpenAI (GPT-4o) con Prompt de Extracción Pura
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.value}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "gpt-4o",
            messages: [
                { 
                    role: "system", 
                    content: "Eres un extractor de datos clínico. Tu salida DEBE ser un JSON puro. No hables, solo extrae." 
                },
                { 
                    role: "user", 
                    content: `Extrae la siguiente información del chat:
                    1. EMAIL: Busca patrones @.
                    2. CIUDAD: Ubicación mencionada.
                    3. NOMBRE: Nombre real del cliente.
                    4. INTENT: BAJO, MEDIO o ALTO (si pidió reserva/pago).
                    5. SUMMARY: Resumen de 15 palabras.
                    6. PSYCH: Perfil psicológico breve.

                    CHAT:
                    ${transcript}

                    FORMATO JSON OBLIGATORIO:
                    {
                        "email": "valor o null",
                        "ciudad": "valor o null",
                        "nombre": "valor o null",
                        "buying_intent": "ALTO/MEDIO/BAJO",
                        "summary": "texto",
                        "perfil_psicologico": "texto"
                    }`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI falló: ${err}`);
    }

    const aiData = await response.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // 4. Actualizar Base de Datos (Limpiando nulos para no borrar datos existentes)
    const updatePayload: any = {
        last_ai_analysis: new Date().toISOString()
    };

    if (result.email) updatePayload.email = result.email.trim();
    if (result.ciudad) updatePayload.ciudad = result.ciudad.trim();
    if (result.nombre && result.nombre.length > 2) updatePayload.nombre = result.nombre.trim();
    if (result.buying_intent) updatePayload.buying_intent = result.buying_intent;
    if (result.summary) updatePayload.summary = result.summary;
    if (result.perfil_psicologico) updatePayload.perfil_psicologico = result.perfil_psicologico;

    console.log("[analyze-leads] Guardando datos extraídos:", updatePayload);

    const { data: updatedLead, error: updateError } = await supabaseClient
        .from('leads')
        .update(updatePayload)
        .eq('id', lead_id)
        .select()
        .single();

    if (updateError) throw updateError;

    // 5. Retornar éxito al frontend
    return new Response(
        JSON.stringify({ 
            success: true, 
            lead: updatedLead, 
            extracted: result 
        }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("[analyze-leads] Error Crítico:", error.message);
    return new Response(
        JSON.stringify({ success: false, error: error.message }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } // Retornamos 200 con success:false para manejarlo en UI
    );
  }
})