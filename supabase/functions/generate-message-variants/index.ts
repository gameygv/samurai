const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { message, count = 4 } = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return new Response(JSON.stringify({ error: 'Mensaje requerido (mínimo 5 caracteres)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY no configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const variantCount = Math.min(Math.max(count, 2), 8);

    const systemPrompt = `Eres un asistente que genera variantes mínimas de mensajes de WhatsApp para campañas.
REGLAS ESTRICTAS:
- Mantén el significado EXACTO del mensaje original
- Solo cambia 1-3 palabras por variante, usando sinónimos naturales
- NO agregues ni quites información
- NO cambies el tono ni la intención
- Mantén emojis si los hay, puedes cambiar su posición ligeramente
- Mantén saludos y despedidas similares
- NO uses lenguaje formal si el original es informal (y viceversa)
- Cada variante debe ser diferente a las demás
- Devuelve un JSON array con exactamente ${variantCount} strings, nada más`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Genera ${variantCount} variantes mínimas de este mensaje:\n\n"${message.trim()}"` },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[generate-message-variants] OpenAI error:', errText);
      return new Response(JSON.stringify({ error: 'Error al generar variantes' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const completion = await resp.json();
    const content = completion.choices?.[0]?.message?.content;

    let variants: string[] = [];
    try {
      const parsed = JSON.parse(content);
      // Try every possible key — OpenAI picks its own key name
      if (Array.isArray(parsed)) {
        variants = parsed;
      } else if (typeof parsed === 'object' && parsed !== null) {
        // Find the first array value in the object
        for (const key of Object.keys(parsed)) {
          if (Array.isArray(parsed[key])) {
            variants = parsed[key];
            break;
          }
        }
      }
    } catch {
      console.error('[generate-message-variants] Parse error:', content);
      // Try to extract lines as fallback
      if (content && typeof content === 'string') {
        variants = content.split('\n').filter((l: string) => l.trim().length > 10 && !l.startsWith('{') && !l.startsWith('"'));
      }
      if (variants.length === 0) {
        return new Response(JSON.stringify({ error: 'No se pudieron parsear las variantes' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Ensure we have strings
    variants = variants.filter((v: unknown) => typeof v === 'string' && (v as string).trim().length > 0);

    return new Response(JSON.stringify({
      success: true,
      original: message.trim(),
      variants,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[generate-message-variants] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
