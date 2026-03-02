// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url, mode } = await req.json();
    console.log(`[scrape-website] Iniciando proceso en modo: ${mode || 'WEB'}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (mode === 'VISION') {
       console.log(`[scrape-website] Analizando imagen: ${url}`);
       
       // 1. Verificar API Key
       const { data: config, error: configError } = await supabaseClient
          .from('app_config')
          .select('value')
          .eq('key', 'gemini_api_key')
          .maybeSingle();
          
       if (configError || !config?.value) {
          console.error("[scrape-website] Error: Gemini API Key no encontrada en app_config.");
          throw new Error("Gemini API Key no configurada. Ve a Ajustes > API Keys.");
       }

       // 2. Descargar imagen
       const imgResponse = await fetch(url);
       if (!imgResponse.ok) {
          console.error(`[scrape-website] Error descargando imagen: ${imgResponse.statusText}`);
          throw new Error(`No se pudo acceder a la imagen: ${imgResponse.statusText}`);
       }
       
       const imgBlob = await imgResponse.blob();
       const arrayBuffer = await imgBlob.arrayBuffer();
       
       // Convertir a Base64 de forma compatible con Deno
       const uint8Array = new Uint8Array(arrayBuffer);
       let binary = '';
       for (let i = 0; i < uint8Array.byteLength; i++) {
         binary += String.fromCharCode(uint8Array[i]);
       }
       const base64String = btoa(binary);

       // 3. Llamar a Gemini
       console.log("[scrape-website] Enviando a Gemini AI...");
       const prompt = "Extrae todo el texto de esta imagen. Si es un poster de The Elephant Bowl, identifica ciudad, fechas y precios.";
       
       const response = await fetch(`${GEMINI_URL}?key=${config.value}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: imgBlob.type || "image/jpeg", data: base64String } }
              ]
            }]
          })
       });

       if (!response.ok) {
         const errorText = await response.text();
         console.error(`[scrape-website] Gemini API Error: ${errorText}`);
         throw new Error("Error en la API de Google Gemini. Verifica tu API Key.");
       }
       
       const aiData = await response.json();
       const text = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;

       if (!text) throw new Error("La IA no pudo leer texto en esta imagen.");

       console.log("[scrape-website] OCR exitoso.");
       return new Response(JSON.stringify({ success: true, content: text }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    // --- MODO WEB (Simplificado para evitar errores de importación) ---
    return new Response(JSON.stringify({ success: false, error: "Modo WEB no implementado en esta versión robusta." }), {
       status: 400,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("[scrape-website] Error Crítico:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), { 
        status: 200, // Devolvemos 200 para que el cliente pueda leer el JSON de error
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})