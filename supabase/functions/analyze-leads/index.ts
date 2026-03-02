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

    const { force, lead_id } = await req.json().catch(() => ({}));
    
    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string) => configs?.find(c => c.key === key)?.value || null;
    const apiKey = getConfig('gemini_api_key');

    if (!apiKey) throw new Error("Gemini API Key missing.");

    // Construcción de query dinámica
    let query = supabaseClient.from('leads').select('*');
    
    if (lead_id) {
       // Modo Quirúrgico: Analizar un lead específico (usado desde el chat)
       query = query.eq('id', lead_id);
    } else {
       // Modo Barrido: Analizar los más recientes
       query = query.order('last_message_at', { ascending: false }).limit(10);
    }

    const { data: activeLeads } = await query;
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
            4. NOMBRE: Si el usuario dice "Soy Juan", extráelo. Si el lead ya tiene nombre, confírmalo o mejóralo.
            
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

         // Lógica de actualización inteligente: Solo sobrescribir si hay dato nuevo
         if (analysis.email) updateData.email = analysis.email;
         if (analysis.city) updateData.city = analysis.city; // Guardamos en 'city' temporalmente para mapear a 'ciudad'
         
         // Mapeo correcto a columnas de la BD
         if (updateData.city) {
             updateData.ciudad = updateData.city;
             delete updateData.city;
         }

         const detectedName = `${analysis.fn || ''} ${analysis.ln || ''}`.trim();
         // Actualizar nombre si el actual es genérico o nulo, O si la IA encontró uno mejor
         if (detectedName && detectedName.length > 2) {
             if (!lead.nombre || lead.nombre.includes('Nuevo') || lead.nombre.includes('Lead')) {
                 updateData.nombre = detectedName;
             }
         }

         await supabaseClient.from('leads').update(updateData).eq('id', lead.id);
         results.push({ lead: lead.id, status: 'updated', data: updateData });

       } catch (e) { console.error(`Error procesando lead ${lead.id}:`, e); }
    }

    return new Response(JSON.stringify({ success: true, analyzed: results.length, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})