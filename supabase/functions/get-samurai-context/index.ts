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
    const platform = body.platform || 'WHATSAPP';

    const { data: configs } = await supabaseClient.from('app_config').select('key, value');
    const getConfig = (key: string, def = "") => configs?.find((c: any) => c.key === key)?.value || def;

    // --- REGLAS PSICOGRÁFICAS BASADAS EN CEREBRO CORE ---
    const psychStrategy = `
### ESTRATEGIA DE PERFILAMIENTO PSICOGRÁFICO:
Usa la información técnica que tienes para educar y preguntar:
1. Si el cliente pregunta por el sonido, menciona la "Psicoacústica" y pregunta: "¿Te interesa para uso personal o para integrarlo en alguna terapia que ya realices?"
2. Usa datos del Cerebro Core para demostrar autoridad antes de pedir datos.
3. REGLA WHATSAPP: Estás en ${platform}. Ya tienes su teléfono (${lead.telefono}). NO lo pidas.
`;

    // --- CARGA DE DATOS BANCARIOS (CERO ALUCINACIÓN) ---
    const bankData = `
### [DATOS DE PAGO - VERDAD ABSOLUTA]
PROHIBIDO INVENTAR CUENTAS. USA SOLO ESTO:
Banco: ${getConfig('bank_name')}
Cuenta: ${getConfig('bank_account')}
CLABE: ${getConfig('bank_clabe')}
Titular: ${getConfig('bank_holder')}
`;

    // (Concatenación de prompts de usuario y sistema...)
    const systemPrompt = `
${psychStrategy}
${getConfig('prompt_alma_samurai')}
${getConfig('prompt_adn_core')}
${getConfig('prompt_behavior_rules')}
${bankData}
`;

    return new Response(JSON.stringify({ system_prompt: systemPrompt }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})