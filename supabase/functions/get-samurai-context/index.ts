// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const body = await req.json().catch(() => ({}));
    const lead = body.lead || {};

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string, def = "") => configs?.find((c: any) => c.key === key)?.value || def;

    // --- PROTOCOLO HARDCODED DE CAPTURA ---
    const missingData = [];
    if (!lead.nombre || lead.nombre.includes('Nuevo')) missingData.push("NOMBRE COMPLETO");
    if (!lead.ciudad) missingData.push("CIUDAD/UBICACIÓN");
    if (!lead.email) missingData.push("EMAIL");
    if (!lead.telefono) missingData.push("TELÉFONO");

    const gatheringProtocol = missingData.length > 0 
      ? `\n🚨 [PROTOCOLO CRÍTICO DE CAPTURA - FASE 1]:
Faltan los siguientes datos obligatorios: ${missingData.join(', ')}.
INSTRUCCIÓN: Antes de enviar catálogos, posters o precios, DEBES obtener estos datos de forma natural pero persistente. 
Si el cliente pregunta algo, responde brevemente y de inmediato pide uno de los datos faltantes. 
NO AVANCES A LA VENTA SIN EMAIL Y CIUDAD.` 
      : `\n✅ [PROTOCOLO DE CAPTURA COMPLETO]: Procede con la Fase 2 (Seducción Visual) y Fase 3 (Cierre).`;

    // --- CARGAR CONTEXTO DINÁMICO ---
    const { data: webPages } = await supabaseClient.from('main_website_content').select('title, content').eq('scrape_status', 'success');
    const masterTruth = webPages?.map(p => `[DATA WEB: ${p.title}]: ${p.content.substring(0, 1000)}...`).join('\n') || "";

    const pAlma = getConfig('prompt_alma_samurai');
    const pAdn = getConfig('prompt_adn_core');
    const pRelearning = getConfig('prompt_relearning');
    const pBehavior = getConfig('prompt_behavior_rules');

    const systemPrompt = `
${pAlma}
${pAdn}

${gatheringProtocol}

=== REGLAS DE CONDUCTA ===
${pBehavior}

=== REGLAS #CIA (APRENDIZAJE) ===
${pRelearning}

=== VERDAD MAESTRA (TIENDA) ===
${masterTruth}
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})