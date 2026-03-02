// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { force } = await req.json().catch(() => ({}));
    
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find(c => c.key === key)?.value || null;
    const apiKey = getConfig('gemini_api_key');

    if (!apiKey) throw new Error("Gemini API Key missing.");

    // Seleccionamos leads recientes O leads que nunca han sido analizados
    const { data: activeLeads } = await supabaseClient
      .from('leads')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(10);

    const results = [];

    for (const lead of activeLeads || []) {
       try {
         const { data: messages } = await supabaseClient
            .from('conversaciones')
            .select('emisor, mensaje')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: true }) 
            .limit(100);

         if (!messages || messages.length === 0) continue;

         const transcript = messages.map(m => `${m.emisor}: ${m.mensaje}`).join('\n');

         const prompt = `
            Eres el Analista de Datos del CRM Samurai. Tu ÚNICA misión es extraer datos estructurados para Meta CAPI.
            
            HISTORIAL:
            ${transcript}

            INSTRUCCIONES DE EXTRACCIÓN:
            1. EMAIL: Busca patrones de correo (ej: @gmail, @hotmail). Si no hay, devuelve null.
            2. CIUDAD: Infiere la ciudad por contexto (ej: "soy de GDL", "CDMX", "vivo en Monterrey"). Si es ambigua, null.
            3. INTENCIÓN: 
               - BAJO: Saludos, info general.
               - MEDIO: Preguntas específicas (fechas, temario).
               - ALTO: Pide link de pago, cuenta bancaria o precio final.
            4. NOMBRE: Si el usuario dice "Soy Juan", extráelo.
            
            Responde SOLO este JSON:
            {
              "fn": "Nombre o null",
              "ln": "Apellido o null",
              "email": "email@dominio.com o null",
              "city": "Ciudad o null",
              "intent_label": "BAJO" | "MEDIO" | "ALTO",
              "summary": "Resumen ejecutivo de 1 linea",
              "psych_profile": "Perfil psicográfico breve (Analítico/Impulsivo/Amable)"
            }
         `;

         const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
         });

         const aiData = await response.json();
         const rawText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
         if (!rawText) continue;
         
         const analysis = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());

         const updateData: any = {
            last_analyzed_at: new Date().toISOString(),
            summary: analysis.summary,
            buying_intent: analysis.intent_label,
            perfil_psicologico: analysis.psych_profile
         };

         // Solo actualizar si hay datos nuevos y valiosos
         if (analysis.email && !lead.email) updateData.email = analysis.email;
         if (analysis.city && !lead.ciudad) updateData.ciudad = analysis.city;
         
         const detectedName = `${analysis.fn || ''} ${analysis.ln || ''}`.trim();
         // Si el nombre actual es genérico o nulo, y la IA encontró uno, actualízalo
         if (detectedName && (lead.nombre?.includes('Nuevo') || !lead.nombre)) {
            updateData.nombre = detectedName;
         }

         await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
         results.push({ lead: lead.id, status: 'updated', data: updateData });

       } catch (e) { console.error(e); }
    }

    return new Response(JSON.stringify({ success: true, analyzed: results.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})