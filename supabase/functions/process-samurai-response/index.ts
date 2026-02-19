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

    let lead = null;
    
    // 1. IDENTIFICACIÓN DEL LEAD (MÁS ESTRICTA)
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
        const { data } = await supabaseClient
            .from('leads')
            .select('*')
            .or(`telefono.ilike.%${cleanPhone}%,telefono.ilike.%${rawPhone}%`)
            .limit(1)
            .maybeSingle();
        lead = data;
    }

    // BLOQUEO DE FANTASMAS: Solo crear si hay datos reales
    if (!lead && (cleanPhone || kommo_id)) {
        const { data: upsertedLead, error: upsertError } = await supabaseClient.from('leads').upsert({
            nombre: name || 'Nuevo Lead WhatsApp',
            telefono: rawPhone,
            kommo_id: kommo_id || null,
            last_message_at: new Date().toISOString()
        }, { onConflict: 'telefono' }).select().single();
        
        if (!upsertError) lead = upsertedLead;
    }

    if (!lead) throw new Error("No se pudo identificar ni crear el lead (Datos insuficientes).");

    // 2. PROCESAMIENTO DE CONOCIMIENTO
    let fullText = typeof ai_json_response === 'string' ? ai_json_response : (ai_json_response?.reply || "");
    let cleanText = fullText;
    let analysisData: any = null;

    // Detectar bloque de análisis (mejorado para capturar datos de identidad)
    const separators = ['---SYSTEM_ANALYSIS---', '[[ANALYSIS:', '---ANALYSIS---'];
    for (const sep of separators) {
        if (fullText.includes(sep)) {
            const parts = fullText.split(sep);
            cleanText = parts[0].trim();
            try {
                const jsonPart = parts[1].trim().replace(/```json/g, '').replace(/```/g, '').replace(/\]\]/g, '').trim();
                if (jsonPart.startsWith('{')) analysisData = JSON.parse(jsonPart);
            } catch (e) {}
            break;
        }
    }

    const updateData: any = { 
        last_message_at: new Date().toISOString()
    };

    // ACTUALIZAR FICHA CON CONOCIMIENTO DETECTADO
    if (analysisData) {
        updateData.last_ai_analysis = new Date().toISOString();
        if (analysisData.mood) updateData.estado_emocional_actual = analysisData.mood;
        if (analysisData.intent) updateData.buying_intent = analysisData.intent;
        if (analysisData.summary) updateData.summary = analysisData.summary;
        
        // ¡IMPORTANTE! Inyectar identidad si la IA la descubre
        if (analysisData.name && (!lead.nombre || lead.nombre.includes('Nuevo Lead'))) {
            updateData.nombre = analysisData.name;
        }
        if (analysisData.city && !lead.ciudad) {
            updateData.ciudad = analysisData.city;
        }
        
        if (analysisData.handoff_required === true) updateData.ai_paused = true;
    }

    await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
    await supabaseClient.from('conversaciones').insert({ 
        lead_id: lead.id, 
        emisor: is_client_message ? 'CLIENTE' : 'SAMURAI', 
        mensaje: cleanText, 
        platform: 'API' 
    });

    return new Response(JSON.stringify({ success: true, reply: cleanText, lead_id: lead.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    console.error("[process-samurai-response] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})