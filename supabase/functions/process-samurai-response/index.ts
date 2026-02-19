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

    const { ai_json_response, lead_id, kommo_id, phone, name, is_client_message = false } = await req.json();

    // 1. IDENTIFICAR AL LEAD (Lógica de búsqueda mejorada)
    let lead = null;
    
    // Intento 1: Por ID interno
    if (lead_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('id', lead_id).single();
        lead = data;
    } 
    
    // Intento 2: Por Kommo ID
    if (!lead && kommo_id) {
        const { data } = await supabaseClient.from('leads').select('*').eq('kommo_id', kommo_id).single();
        lead = data;
    }

    // Intento 3: Por Teléfono (Crucial para conversaciones de WhatsApp sin ID)
    if (!lead && phone) {
        const cleanPhone = phone.toString().replace(/\D/g, ''); // Limpiar caracteres no numéricos
        const { data } = await supabaseClient.from('leads').select('*').ilike('telefono', `%${cleanPhone}%`).single();
        lead = data;
    }

    // Intento 4: Auto-creación si no existe (Para leads nuevos de WhatsApp)
    if (!lead && (phone || kommo_id)) {
        console.log("[process-samurai-response] Lead no encontrado, creando uno nuevo...");
        const { data: newLead, error: createError } = await supabaseClient.from('leads').insert({
            nombre: name || 'Nuevo Lead WhatsApp',
            telefono: phone || 'Sin teléfono',
            kommo_id: kommo_id || null,
            last_message_at: new Date().toISOString()
        }).select().single();

        if (createError) throw createError;
        lead = newLead;
    }

    if (!lead) throw new Error("Lead not found and cannot be created without phone or ID.");

    // 2. LIMPIAR EL TEXTO Y EXTRAER METADATOS
    let fullText = typeof ai_json_response === 'string' ? ai_json_response : (ai_json_response?.reply || "");
    let cleanText = fullText;
    let analysisData: any = null;

    const separators = ['---SYSTEM_ANALYSIS---', '[[ANALYSIS:', '---ANALYSIS---'];
    
    for (const sep of separators) {
        if (fullText.includes(sep)) {
            const parts = fullText.split(sep);
            cleanText = parts[0].trim();
            
            try {
                const jsonPart = parts[1].trim();
                const jsonCleaned = jsonPart.replace(/```json/g, '').replace(/```/g, '').replace(/\]\]/g, '').trim();
                if (jsonCleaned.startsWith('{')) {
                    analysisData = JSON.parse(jsonCleaned);
                }
            } catch (e) {
                console.warn("[process-samurai-response] Metadata parse error ignored.");
            }
            break;
        }
    }

    // 3. ACTUALIZAR DASHBOARD (RADAR DE LEADS)
    const updateData: any = { 
        last_message_at: new Date().toISOString() 
    };

    if (analysisData) {
        updateData.last_ai_analysis = new Date().toISOString();
        if (analysisData.mood) updateData.estado_emocional_actual = analysisData.mood;
        if (analysisData.intent) updateData.buying_intent = analysisData.intent;
        if (analysisData.summary) updateData.summary = analysisData.summary;
        if (analysisData.handoff_required === true) updateData.ai_paused = true;
        
        if (analysisData.detected_name && (!lead.nombre || lead.nombre.includes('Nuevo Lead'))) {
            updateData.nombre = analysisData.detected_name;
        }
        if (analysisData.detected_city) {
            updateData.ciudad = analysisData.detected_city;
        }
    }

    await supabaseClient.from('leads').update(updateData).eq('id', lead.id);

    // 4. GUARDAR EN HISTORIAL
    await supabaseClient.from('conversaciones').insert({
        lead_id: lead.id,
        emisor: is_client_message ? 'CLIENTE' : 'SAMURAI',
        mensaje: cleanText, 
        platform: 'API'
    });

    return new Response(
      JSON.stringify({ 
         success: true, 
         reply: cleanText,
         lead_id: lead.id,
         handoff: analysisData?.handoff_required || false 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error("[process-samurai-response] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})