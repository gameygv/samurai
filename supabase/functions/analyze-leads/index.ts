import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const body = await req.json();
    const lead_id = body.lead_id;
    
    if (!lead_id) return new Response(JSON.stringify({ error: 'lead_id required' }), { headers: corsHeaders });

    const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single();
    if (!lead) return new Response(JSON.stringify({ error: 'Lead not found' }), { headers: corsHeaders });

    // BLINDAJE 1: Nunca analizar ni cambiar leads que ya están en COMPRADO
    if (lead.buying_intent === 'COMPRADO') {
      return new Response(JSON.stringify({ message: 'Ignorado: Lead ya está ganado' }), { headers: corsHeaders });
    }

    // BLINDAJE 2: Si por alguna razón extraña llegó como PERDIDO, lo rescatamos a BAJO
    if (lead.buying_intent === 'PERDIDO') {
       await supabase.from('leads').update({ buying_intent: 'BAJO' }).eq('id', lead.id);
       lead.buying_intent = 'BAJO';
    }

    const { data: configs } = await supabase.from('app_config').select('key, value');
    const configMap: Record<string, unknown> = configs?.reduce((acc: Record<string, unknown>, c: { key: string; value: unknown }) => ({ ...acc, [c.key]: c.value }), {} as Record<string, unknown>) || {};
    const apiKey = Deno.env.get('OPENAI_API_KEY') || configMap.openai_api_key;

    if (!apiKey) return new Response(JSON.stringify({ message: 'No API key' }), { headers: corsHeaders });

    const { data: lastMessages } = await supabase.from('conversaciones')
      .select('mensaje, emisor')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(3);

    const clientMessages = (lastMessages || []).filter(m => m.emisor === 'CLIENTE').map(m => m.mensaje).join('\n');
    if (!clientMessages) return new Response(JSON.stringify({ message: 'No client messages' }), { headers: corsHeaders });

    const analysisPrompt = `Analiza este mensaje de cliente y extrae:
    1. Ciudad (si la menciona)
    2. Email (si lo menciona)
    3. Código postal (cp): si el cliente menciona un código postal (5 dígitos numéricos, ej. "06600", "45050"). Si no lo menciona, null.
    4. Intención de compra: Responde ESTRICTAMENTE con una de estas tres palabras: "BAJO", "MEDIO" o "ALTO". (Nunca respondas PERDIDO).

    Mensaje:
    ${clientMessages}

    Responde en JSON exacto: {"ciudad": "", "email": "", "cp": null, "intent": "BAJO"}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: "gpt-4o-mini", 
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!aiRes.ok) throw new Error(`OpenAI HTTP ${aiRes.status}: ${await aiRes.text()}`);
    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || '{}';

    try {
      const parsed = JSON.parse(content);
      const updates: Record<string, string> = {};
      
      // BLINDAJE 3 DE HIERRO: Solo permitimos que la IA asigne estados positivos.
      const allowedIntents = ['BAJO', 'MEDIO', 'ALTO'];
      let newIntent = parsed.intent ? String(parsed.intent).toUpperCase() : '';
      
      if (allowedIntents.includes(newIntent)) {
         updates.buying_intent = newIntent;
      } else {
         // Si la IA alucina y responde "PERDIDO" u otra cosa, forzamos BAJO.
         updates.buying_intent = allowedIntents.includes(lead.buying_intent) ? lead.buying_intent : 'BAJO';
      }
      
      if (parsed.ciudad && parsed.ciudad.length > 2) updates.ciudad = parsed.ciudad;
      if (parsed.email && parsed.email.includes('@')) updates.email = parsed.email;
      if (parsed.cp && /^\d{5}$/.test(String(parsed.cp))) updates.cp = String(parsed.cp);

      // Doble validación final
      if (updates.buying_intent === 'PERDIDO') updates.buying_intent = 'BAJO';

      await supabase.from('leads').update(updates).eq('id', lead.id);

      // S6.3: CAPI automático — disparar evento Lead cuando intent sube
      const intentOrder: Record<string, number> = { 'BAJO': 0, 'MEDIO': 1, 'ALTO': 2 };
      const oldIntentLevel = intentOrder[lead.buying_intent] ?? 0;
      const newIntentLevel = intentOrder[updates.buying_intent] ?? 0;

      const metaPixelId = Deno.env.get('META_PIXEL_ID') || configMap.meta_pixel_id;
      const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN') || configMap.meta_access_token;

      if (newIntentLevel > oldIntentLevel && metaPixelId && metaAccessToken) {
        try {
          await supabase.functions.invoke('meta-capi-sender', {
            body: {
              config: {
                pixel_id: metaPixelId,
                access_token: metaAccessToken,
                test_event_code: configMap.meta_test_event_code || undefined
              },
              eventData: {
                event_name: 'Lead',
                event_id: `samurai_lead_${lead.id}_${updates.buying_intent}`,
                lead_id: lead.id,
                user_data: {
                  ph: lead.telefono,
                  fn: lead.nombre?.split(' ')[0],
                  ln: lead.nombre?.split(' ').slice(1).join(' ') || undefined,
                  em: updates.email || lead.email || undefined,
                  ct: updates.ciudad || lead.ciudad || undefined,
                  country: 'mx'
                },
                custom_data: {
                  source: 'samurai_auto',
                  content_name: `intent_${lead.buying_intent}_to_${updates.buying_intent}`
                }
              }
            }
          });
        } catch (capiErr) {
          console.error('CAPI auto error:', capiErr);
        }
      }

      // S5.2: Auto-routing por ciudad cuando se detecta una nueva
      if (updates.ciudad && !lead.assigned_to) {
        try {
          const routingMode = configMap.channel_routing_mode;
          if (routingMode === 'auto') {
            const { data: agents } = await supabase
              .from('profiles')
              .select('id, full_name, territories')
              .eq('is_active', true);

            if (agents && agents.length > 0) {
              const cityLower = updates.ciudad.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              const specialists = agents.filter(a => a.territories && a.territories.length > 0);
              const multiTerritory = agents.filter(a => !a.territories || a.territories.length === 0);

              let assignedAgent: { id: string; full_name: string | null; territories: string[] | null } | null = null;
              let routeType = '';

              // Paso 1: matching exacto entre especialistas
              if (specialists.length > 0) {
                const matched = specialists.filter(a =>
                  a.territories.some((t: string) =>
                    t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === cityLower
                  )
                );

                if (matched.length > 0) {
                  assignedAgent = matched[Math.floor(Math.random() * matched.length)];
                  routeType = 'match exacto';
                } else {
                  // Paso 2: fallback IA — ciudad mas cercana entre especialistas
                  const territoriesMap = specialists.map(a =>
                    `${a.full_name} (${a.id}): ${a.territories.join(', ')}`
                  ).join('\n');

                  const routingRes = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      model: "gpt-4o-mini",
                      messages: [{ role: 'user', content:
                        `El lead esta en "${updates.ciudad}". Estos son los agentes y sus territorios:\n${territoriesMap}\n\nResponde SOLO con el UUID del agente cuyo territorio es geograficamente mas cercano a "${updates.ciudad}". Si ninguno es cercano, responde "NONE".`
                      }],
                      temperature: 0
                    })
                  });
                  if (!routingRes.ok) throw new Error(`OpenAI routing HTTP ${routingRes.status}`);
                  const routingData = await routingRes.json();
                  const aiAnswer = routingData.choices?.[0]?.message?.content?.trim() || 'NONE';

                  if (aiAnswer !== 'NONE') {
                    const matchedAgent = specialists.find(a => aiAnswer.includes(a.id));
                    if (matchedAgent) {
                      assignedAgent = matchedAgent;
                      routeType = 'IA: ciudad cercana';
                    }
                  }
                }
              }

              // Paso 3: si no hay especialista, asignar round-robin entre multi-territorio
              if (!assignedAgent && multiTerritory.length > 0) {
                assignedAgent = multiTerritory[Math.floor(Math.random() * multiTerritory.length)];
                routeType = 'multi-territorio';
              }

              if (assignedAgent) {
                await supabase.from('leads').update({ assigned_to: assignedAgent.id }).eq('id', lead.id);
                await supabase.from('activity_logs').insert({
                  action: 'UPDATE', resource: 'LEADS',
                  description: `🗺️ Auto-routing: ${lead.nombre} (${updates.ciudad}) → ${assignedAgent.full_name} (${routeType})`,
                  status: 'OK'
                });
              }
            }
          }
        } catch (routingErr) {
          console.error('Auto-routing error:', routingErr);
        }
      }

      return new Response(JSON.stringify({ success: true, intent: updates.buying_intent }), { headers: corsHeaders });

    } catch (parseError) {
      return new Response(JSON.stringify({ message: 'Parse error' }), { headers: corsHeaders });
    }

  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errMsg }), { status: 200, headers: corsHeaders });
  }
});