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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use Service Role for backend access
    )

    // 1. Get Active Prompts
    const { data: configData } = await supabaseClient
      .from('app_config')
      .select('key, value')
      .eq('category', 'PROMPT')

    const prompts: Record<string, string> = {}
    configData?.forEach((item: any) => {
      prompts[item.key] = item.value
    })

    // 2. Get Geoffrey Phrases
    const { data: geoffreyData } = await supabaseClient
      .from('frases_geoffrey')
      .select('frase, categoria')
      .eq('active', true)

    // 3. Construct the System Prompt
    const fullSystemPrompt = `
${prompts['prompt_core'] || ''}

${prompts['prompt_technical'] || ''}

${prompts['prompt_behavior'] || ''}

${prompts['prompt_objections'] || ''}

GEOFFREY PHRASES (Use sparingly):
${geoffreyData?.map((g: any) => `- [${g.categoria}] ${g.frase}`).join('\n') || ''}
    `

    return new Response(
      JSON.stringify({
        status: 'success',
        version: 'v8.0',
        system_prompt: fullSystemPrompt,
        config: {
            temperature: 0.3,
            model: 'gemini-1.5-pro'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})