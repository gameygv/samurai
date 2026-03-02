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
            Eres el Analista Maestro de Samurai AI. Tu objetivo es mapear al lead para Meta CAPI y Estrategia de Ventas Localizada.
            
            HISTORIAL:
            ${transcript}

            INSTRUCCIONES:
            1. LOCALIZACIÓN: Sé extremadamente preciso. Si dice "estoy en la Roma", la ciudad es "CDMX". Si dice "cerca de la Minerva", es "Guadalajara".
            2. INTENCIÓN: 
               - BAJO: Saludo inicial.
               - MEDIO: Pregunta por un curso específico o fechas.
               - ALTO: Pidió el link de pago o detalles para depositar los $1500.
            3. EMAIL: Extrae cualquier cadena que parezca un correo.
            
            Formato JSON:
            {
              "fn": "Nombre",
              "ln": "Apellido",
              "email": "email@... | null",
              "city": "Ciudad Real",
              "intent_label": "BAJO" | "MEDIO" | "ALTO",
              "summary": "Resumen de la situación actual."
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
            ciudad: analysis.city || lead.ciudad
         };

         if (analysis.email) updateData.email = analysis.email;
         const detectedName = `${analysis.fn || ''} ${analysis.ln || ''}`.trim();
         if (detectedName && (lead.nombre?.includes('Nuevo') || !lead.nombre)) updateData.nombre = detectedName;

         await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
         results.push({ lead: lead.id, status: 'updated' });

       } catch (e) { console.error(e); }
    }

    return new Response(JSON.stringify({ success: true, analyzed: results.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})