import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { lookupGeo, inferGender } from '../_shared/mexico-geo.ts'

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const body = await req.json();
    const lead_id = body.lead_id;
    
    if (!lead_id) return new Response(JSON.stringify({ error: 'lead_id required' }), { headers: corsHeaders });

    const { data: lead } = await supabase.from('leads').select('*').eq('id', lead_id).single();
    if (!lead) return new Response(JSON.stringify({ error: 'Lead not found' }), { headers: corsHeaders });

    // BLINDAJE 1: Leads ya en COMPRADO nunca bajan de etapa, pero sí extraemos datos
    // adicionales del chat (email, ciudad, etc.) para mejorar matching en eventos CAPI futuros.
    const lockIntent = lead.buying_intent === 'COMPRADO';

    // BLINDAJE 2: Si por alguna razón extraña llegó como PERDIDO, lo rescatamos a BAJO
    if (lead.buying_intent === 'PERDIDO') {
       await supabase.from('leads').update({ buying_intent: 'BAJO' }).eq('id', lead.id);
       lead.buying_intent = 'BAJO';
    }

    // 2026-04-10: Verificar si hay comprobante válido registrado → permite auto-COMPRADO
    // Regla: PROBABLE_VALID + monto > 0 + cuenta matcheada = señal fuerte de pago real
    const { data: validReceipts } = await supabase
       .from('receipt_audits')
       .select('ai_verdict, amount_detected, matched_account, human_verified')
       .eq('lead_id', lead_id)
       .eq('ai_verdict', 'PROBABLE_VALID')
       .gt('amount_detected', 0)
       .neq('matched_account', 'No identificada')
       .limit(1);
    const hasValidReceipt = !!(validReceipts && validReceipts.length > 0);

    const { data: configs } = await supabase.from('app_config').select('key, value');
    const configMap: Record<string, unknown> = configs?.reduce((acc: Record<string, unknown>, c: { key: string; value: unknown }) => ({ ...acc, [c.key]: c.value }), {} as Record<string, unknown>) || {};
    const apiKey = Deno.env.get('OPENAI_API_KEY') || configMap.openai_api_key;

    if (!apiKey) return new Response(JSON.stringify({ message: 'No API key' }), { headers: corsHeaders });

    // Obtener últimos 10 mensajes (cliente + asesor) para contexto completo de la conversación
    const { data: lastMessages } = await supabase.from('conversaciones')
      .select('mensaje, emisor')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!lastMessages || lastMessages.length === 0) return new Response(JSON.stringify({ message: 'No messages' }), { headers: corsHeaders });

    // Construir conversación con roles para que la IA entienda el contexto completo
    const chatContext = lastMessages.reverse().map(m => {
      const role = m.emisor === 'CLIENTE' ? 'CLIENTE' : 'ASESOR';
      return `${role}: ${m.mensaje}`;
    }).join('\n');

    // Leer prompt desde Cerebro Core (editable en UI) con fallback hardcodeado
    // 2026-04-10: fallback actualizado — más agresivo en escalamiento para no dejar leads
    // estancados en BAJO cuando claramente están negociando. Si el humano editó el prompt
    // en Cerebro Core, se respeta su versión (configMap.prompt_analista_datos).
    const customPrompt = configMap.prompt_analista_datos as string | undefined;
    const basePrompt = customPrompt || `Eres el Analista de Datos de Samurai. Tu mision es leer el historial completo del chat y clasificar al cliente en la etapa CORRECTA del embudo de ventas. El negocio pierde DINERO cuando un lead queda atorado en una etapa más baja de la que realmente corresponde, porque los eventos CAPI a Meta son la señal que optimiza nuestras campañas de Facebook. Sé AGRESIVO escalando cuando haya señales claras.

REGLAS DE ETAPA (pipeline_stage / intent) — PRIORIZA LA ETAPA MÁS ALTA QUE APLIQUE:

COMPRADO: Solo si el cliente explícitamente dice que YA pagó / ya hizo la transferencia / envió el comprobante reciente (imagen o referencia) y el contexto confirma pago real (monto, banco, referencia). Si solo dice "voy a pagar" todavía NO es COMPRADO.

ALTO (InitiateCheckout en CAPI): Señales fuertes de intención de compra en progreso:
  - Pidió datos bancarios / CLABE / cuenta para transferir
  - Dijo "quiero inscribirme / apartar lugar / reservar"
  - Dio su correo electrónico voluntariamente
  - Preguntó por descuentos, planes de pago, MSI
  - Dijo "voy al banco", "te paso el comprobante", "¿a nombre de quién?"
  - Negocia fechas concretas de pago
  - Pidió link de compra / pasarela

MEDIO (ViewContent en CAPI): Interés real demostrado:
  - Preguntó precio / costo / cuánto cuesta
  - Preguntó fechas, horarios, ubicación, duración
  - Preguntó por requisitos, qué incluye, qué materiales
  - Preguntó por disponibilidad o cupos
  - Dio su ciudad y sigue conversando
  - Compara opciones, hace preguntas específicas del servicio
  - Menciona interés en inscribirse sin haber pedido datos bancarios aún

BAJO (Lead en CAPI): Sin interés claro aún:
  - Solo saluda ("hola", "info por favor", "hola, me interesa")
  - Primer contacto genérico sin contexto
  - Pregunta qué vende el negocio
  - Mensajes cortos sin información

NUNCA respondas "PERDIDO" ni "GANADO". Solo "BAJO", "MEDIO", "ALTO" o "COMPRADO".

IMPORTANTE: si el cliente YA estaba en una etapa alta en un mensaje anterior del historial, asume que sigue en esa etapa a menos que haya señales claras de que se enfrió. NO bajes de etapa sin razón explícita.

Lead Score (lead_score): número 0-100 de probabilidad de compra.
  0-20: Solo saludo, sin interés claro.
  21-40: Pidió información general.
  41-60: Preguntó precios o detalles específicos.
  61-80: Mostró intención de compra, dio datos personales.
  81-100: Quiere pagar, envió comprobante, pidió datos bancarios.

REGLAS DE DATOS GEOGRÁFICOS (CRÍTICO para Meta CAPI):
- "ciudad": Si el cliente menciona de dónde es (ej: "soy de Guadalajara", "vivo en Monterrey", "estoy en Cancún"), extrae la ciudad.
- "estado": Siempre que detectes ciudad, infiere el estado mexicano (ej: Guadalajara → Jalisco, Monterrey → Nuevo León).
- "cp": SIEMPRE que detectes una ciudad, infiere el código postal del CENTRO de esa ciudad (ej: Guadalajara → 44100, Monterrey → 64000, CDMX → 06000). Si el cliente menciona una colonia específica, usa el CP de esa colonia. El CP debe ser exactamente 5 dígitos.
- "genero": Infiere del nombre: "f" para femenino, "m" para masculino, null si no puedes determinarlo.

FECHA DE NACIMIENTO:
- "fecha_nacimiento": Si el cliente menciona su fecha de nacimiento, edad o cumpleaños, extraerla en formato YYYY-MM-DD. Si solo dice la edad, calcular el año aproximado (año actual menos edad) y poner null en día/mes. Si dice "tengo 35 años", poner null. Solo extraer si da fecha específica (ej: "nací el 15 de marzo de 1990" → "1990-03-15").

DATOS FISCALES (extraer SOLO si el cliente los menciona explícitamente en el chat):
- "rfc": RFC del cliente si lo menciona (13 caracteres persona física, 12 moral). Solo si aparece textualmente.
- "direccion": Dirección completa si la menciona (calle, número, colonia).
- "uso_cfdi": Código de uso CFDI si lo menciona (ej: G03, S01, D10). Solo el código.
- "regimen_fiscal": Código de régimen fiscal si lo menciona (ej: 605, 612, 626). Solo el código.`;

    const analysisPrompt = `${basePrompt}

CONVERSACION:
${chatContext}

RESUMEN (summary): Escribe 1 frase corta (máximo 15 palabras) que resuma el estado actual de la conversación. Ejemplos: "Interesada en taller Guadalajara mayo, pidió precios", "Preguntó por cuencos nivel 2, vive en CDMX", "Solo saludó, sin interés claro aún". Sé específico sobre qué curso/servicio le interesa.

Responde UNICAMENTE con este JSON exacto (sin acentos en las claves):
{"nombre": null, "apellido": null, "email": null, "ciudad": null, "estado": null, "cp": null, "genero": null, "fecha_nacimiento": null, "direccion": null, "rfc": null, "uso_cfdi": null, "regimen_fiscal": null, "servicio_interes": null, "summary": null, "intent": "BAJO", "lead_score": 10}`;

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
      // deno-lint-ignore no-explicit-any
      const updates: Record<string, any> = {};

      // BLINDAJE 3 DE HIERRO: La IA solo puede asignar BAJO/MEDIO/ALTO/COMPRADO.
      // COMPRADO solo se acepta si hay evidencia externa (comprobante válido).
      const allowedIntents = ['BAJO', 'MEDIO', 'ALTO', 'COMPRADO'];
      const intentOrder: Record<string, number> = { 'BAJO': 0, 'MEDIO': 1, 'ALTO': 2, 'COMPRADO': 3 };
      const aiIntent = parsed.intent ? String(parsed.intent).toUpperCase() : '';

      let finalIntent: string;
      if (lockIntent) {
        // Lead ya comprado → no mover
        finalIntent = lead.buying_intent;
      } else if (aiIntent === 'COMPRADO') {
        // Solo aceptamos COMPRADO de la IA si hay un comprobante PROBABLE_VALID con match
        finalIntent = hasValidReceipt ? 'COMPRADO' : 'ALTO';
      } else if (allowedIntents.includes(aiIntent)) {
        finalIntent = aiIntent;
      } else {
        finalIntent = allowedIntents.includes(lead.buying_intent) ? lead.buying_intent : 'BAJO';
      }

      // REGLA ANTI-DOWNGRADE: si la IA quiere bajar de etapa, respeta la actual
      // (ej. si el lead ya estaba en ALTO y el mensaje actual solo dice "ok gracias",
      // no lo movemos a MEDIO — las transiciones hacia abajo solo son manuales).
      const oldLevel = intentOrder[lead.buying_intent] ?? 0;
      const newLevel = intentOrder[finalIntent] ?? 0;
      if (newLevel < oldLevel && !lockIntent) {
        finalIntent = lead.buying_intent;
      }

      updates.buying_intent = finalIntent;

      // Extraer datos del cliente detectados por la IA
      if (parsed.nombre && parsed.nombre.length > 1 && lead.nombre === 'Lead WhatsApp') updates.nombre = parsed.nombre + (parsed.apellido ? ` ${parsed.apellido}` : '');
      if (parsed.ciudad && parsed.ciudad.length > 2) updates.ciudad = parsed.ciudad;
      if (parsed.estado && parsed.estado.length > 2) updates.estado = parsed.estado;
      if (parsed.email && parsed.email.includes('@')) updates.email = parsed.email;
      if (parsed.cp && /^\d{5}$/.test(String(parsed.cp))) updates.cp = String(parsed.cp);
      if (parsed.servicio_interes && parsed.servicio_interes.length > 2) updates.servicio_interes = parsed.servicio_interes;
      const parsedScore = Number(parsed.lead_score);
      if (!isNaN(parsedScore) && parsedScore >= 0 && parsedScore <= 100) updates.lead_score = parsedScore;
      if (parsed.summary && typeof parsed.summary === 'string' && parsed.summary.length > 3) updates.summary = parsed.summary;

      // Género: primero IA, luego inferencia determinística del nombre — guardar en DB
      const aiGender = parsed.genero === 'f' || parsed.genero === 'm' ? parsed.genero : null;
      const detGender = inferGender(updates.nombre || lead.nombre);
      const finalGender = aiGender || detGender;
      if (finalGender && !lead.genero) updates.genero = finalGender;

      // Fecha de nacimiento: si la IA la detectó en el chat (formato YYYY-MM-DD)
      if (parsed.fecha_nacimiento && /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.fecha_nacimiento)) && !lead.fecha_nacimiento) {
        updates.fecha_nacimiento = String(parsed.fecha_nacimiento);
      }

      // Datos fiscales: solo si la IA los detectó explícitamente en el chat
      if (parsed.rfc && /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i.test(String(parsed.rfc)) && !lead.rfc) updates.rfc = String(parsed.rfc).toUpperCase();
      if (parsed.direccion && parsed.direccion.length > 5 && !lead.direccion) updates.direccion = parsed.direccion;
      if (parsed.uso_cfdi && /^[A-Z]{1,2}\d{2}$/.test(String(parsed.uso_cfdi)) && !lead.uso_cfdi) updates.uso_cfdi = String(parsed.uso_cfdi).toUpperCase();
      if (parsed.regimen_fiscal && /^\d{3}$/.test(String(parsed.regimen_fiscal)) && !lead.regimen_fiscal) updates.regimen_fiscal = String(parsed.regimen_fiscal);

      // GEO FALLBACK: si tenemos ciudad pero falta CP o estado
      // Nivel 1: mapa determinístico (instantáneo, sin costo)
      // Nivel 2: si la ciudad no está en el mapa → segunda llamada IA para inferir CP
      const effectiveCity = updates.ciudad || lead.ciudad;
      if (effectiveCity && !updates.cp && !lead.cp) {
        const geo = lookupGeo(effectiveCity);
        if (geo) {
          updates.cp = geo.cp;
          if (!updates.estado && !lead.estado) updates.estado = geo.estado;
        } else {
          // Ciudad no está en el mapa → pedir a la IA que infiera el CP
          try {
            const cpRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{ role: 'user', content:
                  `¿Cuál es el código postal (5 dígitos) del centro de "${effectiveCity}", México? Responde SOLO con los 5 dígitos, nada más.`
                }],
                temperature: 0, max_tokens: 10
              })
            });
            if (cpRes.ok) {
              const cpData = await cpRes.json();
              const cpAnswer = cpData.choices?.[0]?.message?.content?.trim() || '';
              const cpMatch = cpAnswer.match(/\d{5}/);
              if (cpMatch) updates.cp = cpMatch[0];
            }
          } catch (_) { /* silenciar error de CP lookup */ }
        }
        // Estado: si aún falta, intentar del mapa o dejar lo que la IA ya puso
        if (effectiveCity && !updates.estado && !lead.estado) {
          const geo2 = lookupGeo(effectiveCity);
          if (geo2) updates.estado = geo2.estado;
        }
      }

      // Doble validación final: PERDIDO nunca pasa
      if (updates.buying_intent === 'PERDIDO') updates.buying_intent = 'BAJO';

      await supabase.from('leads').update(updates).eq('id', lead.id);

      // CAPI ENRIQUECIMIENTO: cuando se completa data nueva (ciudad/cp/email/estado)
      // sin cambio de intent, re-enviar evento CAPI con la data enriquecida
      // para mejorar matching en Meta. Solo si ya se envió al menos un evento antes.
      const dataEnriched = (
        (updates.ciudad && !lead.ciudad) ||
        (updates.cp && !lead.cp) ||
        (updates.email && !lead.email) ||
        (updates.estado && !lead.estado)
      );

      // S6.3: CAPI automático — disparar evento cuando intent sube
      const oldIntentLevel = intentOrder[lead.buying_intent] ?? 0;
      const newIntentLevel = intentOrder[updates.buying_intent] ?? 0;

      const metaPixelId = Deno.env.get('META_PIXEL_ID') || configMap.meta_pixel_id;
      const metaAccessToken = Deno.env.get('META_ACCESS_TOKEN') || configMap.meta_access_token;

      // Per-channel CAPI toggle: skip CAPI for test/dev channels
      let capiEnabled = true;
      if (lead.channel_id) {
          const { data: chCapi } = await supabase.from('whatsapp_channels')
              .select('capi_enabled').eq('id', lead.channel_id).maybeSingle();
          if (chCapi?.capi_enabled === false) capiEnabled = false;
      }

      if (newIntentLevel > oldIntentLevel && metaPixelId && metaAccessToken && capiEnabled) {
        // Mapear transición de embudo → evento CAPI estándar de Meta
        // BAJO→MEDIO: ViewContent (muestra interés real en producto)
        // →ALTO: InitiateCheckout (intención de compra clara)
        // →COMPRADO: Purchase (pago confirmado)
        // Nuevo lead (BAJO): Lead (primer contacto)
        const capiEventMap: Record<string, string> = {
          'MEDIO': 'ViewContent',
          'ALTO': 'InitiateCheckout',
          'COMPRADO': 'Purchase'
        };
        const capiEventName = capiEventMap[updates.buying_intent] || 'Lead';
        const eventTimestamp = Math.floor(Date.now() / 1000);

        // Mejora: AddToCart intermedio — si sube a ALTO y el lead_score >= 50,
        // enviar AddToCart ANTES de InitiateCheckout para dar más señal a Meta
        if (capiEventName === 'InitiateCheckout' && (updates.lead_score || lead.lead_score || 0) >= 50) {
          try {
            await supabase.functions.invoke('meta-capi-sender', {
              body: {
                config: { pixel_id: metaPixelId, access_token: metaAccessToken, test_event_code: configMap.meta_test_event_code || undefined },
                eventData: {
                  event_name: 'AddToCart',
                  event_id: `samurai_${lead.id}_AddToCart`,
                  lead_id: lead.id,
                  user_data: {
                    ph: lead.telefono, fn: (updates.nombre || lead.nombre)?.split(' ')[0],
                    ln: (updates.nombre || lead.nombre)?.split(' ').slice(1).join(' ') || undefined,
                    em: updates.email || lead.email || undefined,
                    ct: updates.ciudad || lead.ciudad || undefined,
                    st: updates.estado || lead.estado || undefined,
                    zp: updates.cp || lead.cp || undefined,
                    ge: finalGender || undefined,
                    db: (updates.fecha_nacimiento || lead.fecha_nacimiento) ? String(updates.fecha_nacimiento || lead.fecha_nacimiento).replace(/-/g, '') : undefined,
                    country: 'mx', external_id: lead.id,
                    fbc: lead.fbc || undefined, ctwa_clid: lead.ctwa_clid || undefined
                  },
                  custom_data: {
                    source: 'samurai_auto', content_name: updates.servicio_interes || lead.servicio_interes || undefined,
                    content_category: 'talleres_cuencoterapia', funnel_stage: 'ALTO', origin_channel: 'whatsapp'
                  }
                }
              }
            });
          } catch (_) {}
        }

        // Monto del Purchase: tomar del receipt válido más reciente si existe
        let purchaseAmount: number | undefined;
        if (capiEventName === 'Purchase' && validReceipts && validReceipts.length > 0) {
          purchaseAmount = Number(validReceipts[0].amount_detected) || undefined;
        }

        try {
          await supabase.functions.invoke('meta-capi-sender', {
            body: {
              config: {
                pixel_id: metaPixelId,
                access_token: metaAccessToken,
                test_event_code: configMap.meta_test_event_code || undefined
              },
              eventData: {
                event_name: capiEventName,
                event_id: `samurai_${lead.id}_${capiEventName}`,
                lead_id: lead.id,
                user_data: {
                  ph: lead.telefono,
                  fn: (updates.nombre || lead.nombre)?.split(' ')[0],
                  ln: (updates.nombre || lead.nombre)?.split(' ').slice(1).join(' ') || undefined,
                  em: updates.email || lead.email || undefined,
                  ct: updates.ciudad || lead.ciudad || undefined,
                  st: updates.estado || lead.estado || undefined,
                  zp: updates.cp || lead.cp || undefined,
                  ge: finalGender || undefined,
                  db: (updates.fecha_nacimiento || lead.fecha_nacimiento) ? String(updates.fecha_nacimiento || lead.fecha_nacimiento).replace(/-/g, '') : undefined,
                  country: 'mx',
                  external_id: lead.id,
                  fbc: lead.fbc || undefined,
                  fbp: lead.fbp || undefined,
                  ctwa_clid: lead.ctwa_clid || undefined
                },
                custom_data: {
                  source: 'samurai_auto',
                  content_name: updates.servicio_interes || lead.servicio_interes || undefined,
                  content_ids: (updates.servicio_interes || lead.servicio_interes) ? [String(updates.servicio_interes || lead.servicio_interes).toLowerCase().replace(/\s+/g, '_')] : undefined,
                  content_category: 'talleres_cuencoterapia',
                  funnel_stage: updates.buying_intent,
                  lead_score: updates.lead_score || lead.lead_score || undefined,
                  agent_id: lead.assigned_to || undefined,
                  origin_channel: 'whatsapp',
                  psychographic_segment: lead.perfil_psicologico || undefined,
                  main_pain: lead.main_pain || undefined,
                  currency: capiEventName === 'Purchase' ? 'MXN' : undefined,
                  value: purchaseAmount,
                  ad_source_id: lead.ad_source_id || undefined,
                  ad_headline: lead.ad_headline || undefined
                }
              }
            }
          });

          await supabase.from('activity_logs').insert({
            action: 'CAPI', resource: 'SYSTEM',
            description: `📡 CAPI ${capiEventName}: ${lead.nombre} (${lead.buying_intent}→${updates.buying_intent})${purchaseAmount ? ` $${purchaseAmount}` : ''}`,
            status: 'OK'
          });
        } catch (capiErr) {
          console.error('CAPI auto error:', capiErr);
        }
      }

      // CAPI ENRIQUECIMIENTO: si data mejoró pero intent no cambió, re-enviar evento
      // para que Meta actualice el perfil del usuario con la nueva info (ciudad, CP, email, etc.)
      // Solo dispara si: (a) hubo enriquecimiento, (b) intent NO subió (ya se envió arriba),
      // (c) ya se envió al menos un evento Lead antes, (d) CAPI habilitado.
      if (dataEnriched && !(newIntentLevel > oldIntentLevel) && lead.capi_lead_event_sent_at && metaPixelId && metaAccessToken && capiEnabled) {
        try {
          const enrichTimestamp = Math.floor(Date.now() / 1000);
          const currentEvent = ({ 'BAJO': 'Lead', 'MEDIO': 'ViewContent', 'ALTO': 'InitiateCheckout', 'COMPRADO': 'Purchase' } as Record<string, string>)[updates.buying_intent] || 'Lead';
          await supabase.functions.invoke('meta-capi-sender', {
            body: {
              config: { pixel_id: metaPixelId, access_token: metaAccessToken, test_event_code: configMap.meta_test_event_code || undefined },
              eventData: {
                event_name: currentEvent,
                event_id: `samurai_${lead.id}_enrich_${enrichTimestamp}`,
                lead_id: lead.id,
                user_data: {
                  ph: lead.telefono,
                  fn: (updates.nombre || lead.nombre)?.split(' ')[0],
                  ln: (updates.nombre || lead.nombre)?.split(' ').slice(1).join(' ') || undefined,
                  em: updates.email || lead.email || undefined,
                  ct: updates.ciudad || lead.ciudad || undefined,
                  st: updates.estado || lead.estado || undefined,
                  zp: updates.cp || lead.cp || undefined,
                  ge: finalGender || undefined,
                  db: (updates.fecha_nacimiento || lead.fecha_nacimiento) ? String(updates.fecha_nacimiento || lead.fecha_nacimiento).replace(/-/g, '') : undefined,
                  country: 'mx',
                  external_id: lead.id,
                  fbc: lead.fbc || undefined,
                  fbp: lead.fbp || undefined,
                  ctwa_clid: lead.ctwa_clid || undefined
                },
                custom_data: {
                  source: 'samurai_enrich',
                  content_name: updates.servicio_interes || lead.servicio_interes || undefined,
                  content_category: 'talleres_cuencoterapia',
                  funnel_stage: updates.buying_intent,
                  lead_score: updates.lead_score || lead.lead_score || undefined,
                  origin_channel: 'whatsapp',
                  currency: currentEvent === 'Purchase' ? 'MXN' : undefined,
                }
              }
            }
          });
          const enrichedFields = [
            updates.ciudad && !lead.ciudad ? 'ciudad' : null,
            updates.cp && !lead.cp ? 'cp' : null,
            updates.email && !lead.email ? 'email' : null,
            updates.estado && !lead.estado ? 'estado' : null,
          ].filter(Boolean).join(', ');
          await supabase.from('activity_logs').insert({
            action: 'CAPI', resource: 'SYSTEM',
            description: `🔄 CAPI Enrich ${currentEvent}: ${lead.nombre} — nuevos campos: ${enrichedFields}`,
            status: 'OK'
          });
        } catch (enrichErr) {
          console.error('CAPI enrich error:', enrichErr);
        }
      }

      // Enviar evento Lead para leads NUEVOS (primera vez que se analiza, intent = BAJO)
      if (oldIntentLevel === 0 && newIntentLevel === 0 && !lead.capi_lead_event_sent_at && metaPixelId && metaAccessToken && capiEnabled) {
        try {
          await supabase.functions.invoke('meta-capi-sender', {
            body: {
              config: { pixel_id: metaPixelId, access_token: metaAccessToken, test_event_code: configMap.meta_test_event_code || undefined },
              eventData: {
                event_name: 'Lead',
                event_id: `samurai_${lead.id}_Lead`,
                lead_id: lead.id,
                user_data: {
                  ph: lead.telefono,
                  fn: (updates.nombre || lead.nombre)?.split(' ')[0],
                  ln: (updates.nombre || lead.nombre)?.split(' ').slice(1).join(' ') || undefined,
                  em: updates.email || lead.email || undefined,
                  ct: updates.ciudad || lead.ciudad || undefined,
                  st: updates.estado || lead.estado || undefined,
                  zp: updates.cp || lead.cp || undefined,
                  ge: finalGender || undefined,
                  db: (updates.fecha_nacimiento || lead.fecha_nacimiento) ? String(updates.fecha_nacimiento || lead.fecha_nacimiento).replace(/-/g, '') : undefined,
                  country: 'mx',
                  external_id: lead.id,
                  fbc: lead.fbc || undefined,
                  fbp: lead.fbp || undefined,
                  ctwa_clid: lead.ctwa_clid || undefined
                },
                custom_data: {
                  source: 'samurai_auto',
                  content_name: updates.servicio_interes || lead.servicio_interes || 'new_lead',
                  content_category: 'talleres_cuencoterapia',
                  funnel_stage: 'BAJO',
                  origin_channel: 'whatsapp',
                  agent_id: lead.assigned_to || undefined,
                  ad_source_id: lead.ad_source_id || undefined,
                  ad_headline: lead.ad_headline || undefined
                }
              }
            }
          });
          await supabase.from('leads').update({ capi_lead_event_sent_at: new Date().toISOString() }).eq('id', lead.id);
        } catch (_) {}
      }

      // S5.2: Routing — assign agent to lead if not yet assigned
      // Priority: 1) channel→agent direct link, 2) auto-routing by city/territory
      if (!lead.assigned_to) {
        try {
          let wasAssignedByChannel = false;

          // Step 1: Check if channel has a direct agent assignment
          if (lead.channel_id) {
            const agentMapRaw = configMap.channel_agent_map;
            if (agentMapRaw) {
              try {
                const agentMap = JSON.parse(agentMapRaw);
                const agentId = agentMap[lead.channel_id];
                if (agentId) {
                  await supabase.from('leads').update({ assigned_to: agentId }).eq('id', lead.id);
                  const { data: agentProfile } = await supabase.from('profiles').select('full_name').eq('id', agentId).maybeSingle();
                  await supabase.from('activity_logs').insert({
                    action: 'UPDATE', resource: 'LEADS',
                    description: `🔗 Vínculo Directo: ${lead.nombre} → ${agentProfile?.full_name || 'Agente'} (canal vinculado)`,
                    status: 'OK'
                  });
                  wasAssignedByChannel = true;
                }
              } catch (_) {}
            }
          }

          // Step 2: If not assigned by channel, try auto-routing by city
          if (!wasAssignedByChannel && updates.ciudad) {
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