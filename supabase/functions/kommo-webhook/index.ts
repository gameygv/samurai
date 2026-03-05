// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Aceptar el formato URL-encoded que a veces usa Kommo o JSON
    let body;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
       const formData = await req.formData();
       body = Object.fromEntries(formData.entries());
    } else {
       body = await req.json().catch(() => ({}));
    }
    
    console.log("[kommo-webhook] Payload recibido:", body);

    // Kommo envía la nota en estructuras variadas dependiendo de la configuración.
    // Buscamos el texto de la nota y el ID del elemento (Lead).
    let noteText = "";
    let kommoEntityId = "";
    
    // Extracción común de Webhooks de Notas en Kommo
    if (body['notes[add][0][element_id]']) {
        kommoEntityId = body['notes[add][0][element_id]'];
        noteText = body['notes[add][0][text]'] || "";
    } else if (body?.notes?.add?.[0]) {
        kommoEntityId = body.notes.add[0].element_id;
        noteText = body.notes.add[0].text || "";
    } else if (body?.message) {
        kommoEntityId = body.lead_id || body.contact_id;
        noteText = body.message.text || body.text || "";
    }

    if (!noteText) {
        return new Response(JSON.stringify({ ignored: true, reason: "No text found" }), { status: 200, headers: corsHeaders });
    }

    // 1. Buscar el Lead en nuestra base de datos vinculando el kommo_id
    const { data: lead } = await supabaseClient.from('leads').select('*').eq('kommo_id', kommoEntityId).maybeSingle();
    
    if (!lead) {
        console.log(`[kommo-webhook] Lead no encontrado para Kommo ID: ${kommoEntityId}`);
        return new Response(JSON.stringify({ error: "Lead no vinculado" }), { status: 200, headers: corsHeaders });
    }

    console.log(`[kommo-webhook] Procesando nota para Lead: ${lead.nombre}`);

    // 2. Procesar Comandos
    if (noteText.includes('#AI_OFF')) {
        await supabaseClient.from('leads').update({ ai_paused: true }).eq('id', lead.id);
        await supabaseClient.from('activity_logs').insert({ 
            action: 'UPDATE', resource: 'LEADS', description: `IA PAUSADA vía Kommo CRM para ${lead.nombre}`, status: 'OK' 
        });
    } 
    else if (noteText.includes('#AI_ON')) {
        await supabaseClient.from('leads').update({ ai_paused: false }).eq('id', lead.id);
        await supabaseClient.from('activity_logs').insert({ 
            action: 'UPDATE', resource: 'LEADS', description: `IA ACTIVADA vía Kommo CRM para ${lead.nombre}`, status: 'OK' 
        });
    }
    else if (noteText.includes('#CIA')) {
        const instruction = noteText.substring(noteText.indexOf('#CIA') + 4).trim();
        if (instruction) {
            await supabaseClient.from('errores_ia').insert({
                cliente_id: lead.id,
                mensaje_cliente: 'Reporte Automático desde Kommo CRM',
                respuesta_ia: 'N/A',
                correccion_sugerida: instruction,
                categoria: 'CONDUCTA',
                estado_correccion: 'REPORTADA'
            });
            await supabaseClient.from('activity_logs').insert({ 
                action: 'CREATE', resource: 'BRAIN', description: `Nueva regla #CIA recibida desde Kommo CRM`, status: 'OK' 
            });
        }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error("[kommo-webhook] Error crítico:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
})