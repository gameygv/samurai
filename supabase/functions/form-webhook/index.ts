import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { invokeFunction } from '../_shared/invoke.ts'

/**
 * form-webhook — Recibe datos del formulario WordPress "Completar Registro"
 *
 * Flujo:
 * 1. Lead paga el curso → chatbot envía link al formulario
 * 2. Lead abre formulario en browser (pixel fires PageView, genera fbp cookie)
 * 3. Lead completa y envía → Elementor webhook POST aquí
 * 4. Esta función: busca lead por email/teléfono, actualiza datos
 * 5. Envía CompleteRegistration a Meta CAPI con fbp del browser
 * 6. Si lead.buying_intent != COMPRADO, lo marca como COMPRADO y envía Purchase CAPI
 */

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const body = await req.json();

    // Validar secret (opcional, configurado en app_config)
    const incomingSecret = req.headers.get('x-form-secret') || body.secret || '';
    const { data: secretCfg } = await supabase.from('app_config')
      .select('value').eq('key', 'form_webhook_secret').maybeSingle();
    const expectedSecret = secretCfg?.value || '';
    if (expectedSecret && incomingSecret !== expectedSecret) {
      console.error('[form-webhook] Invalid secret');
      return new Response('unauthorized', { status: 401 });
    }

    // Campos del formulario Elementor "Completar Registro"
    // Elementor envía: form_fields[name], form_fields[email], etc.
    // o como JSON plano si se configura webhook JSON
    const fields = body.form_fields || body.fields || body;
    const nombre = fields.name || fields.nombre || '';
    const apellido = fields.field_fd37bd0 || fields.apellido || '';
    const email = (fields.email || '').trim().toLowerCase();
    const telefono = (fields.field_b311698 || fields.telefono || '').replace(/\D/g, '');
    const telefonoSecundario = (fields.field_175b899 || fields.telefono_secundario || '').replace(/\D/g, '');
    const genero = fields.field_001635a || fields.genero || '';
    const ciudadSede = fields.field_4261636 || fields.ciudad_sede || '';
    const fechaCurso = fields.field_842d313 || fields.fecha_curso || '';
    const dieta = fields.field_8ce3039 || fields.dieta || '';
    const alergias = fields.field_bc93016 || fields.alergias || '';
    const motivacion = fields.field_8827c9e || fields.motivacion || '';

    // Campos de atribución del browser (inyectados via hidden fields o cookie capture)
    const fbp = fields.fbp || body.fbp || '';
    const fbc = fields.fbc || body.fbc || '';
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('cf-connecting-ip') || '';
    const clientUserAgent = fields.user_agent || body.user_agent ||
                            req.headers.get('user-agent') || '';

    if (!email && !telefono) {
      return new Response(JSON.stringify({ status: 'error', message: 'email o telefono requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Buscar lead por email o teléfono
    let lead: Record<string, unknown> | null = null;

    if (email) {
      const { data: byEmail } = await supabase.from('leads')
        .select('*').ilike('email', email).limit(1).maybeSingle();
      lead = byEmail;
    }

    if (!lead && telefono && telefono.length >= 10) {
      const phoneSuffix = telefono.slice(-10);
      const { data: byPhone } = await supabase.from('leads')
        .select('*').or(`telefono.ilike.%${phoneSuffix}%`).limit(1).maybeSingle();
      lead = byPhone;
    }

    if (!lead) {
      // Log pero no error — puede ser un lead que no pasó por Samurai
      await supabase.from('activity_logs').insert({
        action: 'INFO', resource: 'SYSTEM',
        description: `📋 Formulario web recibido pero lead no encontrado: ${email || telefono}`,
        status: 'OK'
      });
      return new Response(JSON.stringify({ status: 'ok', action: 'lead_not_found', email, telefono }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Actualizar datos del lead
    const updates: Record<string, unknown> = {};
    if (nombre && !lead.nombre) updates.nombre = nombre;
    if (apellido && !lead.apellido) updates.apellido = apellido;
    if (email && !lead.email) updates.email = email;
    if (telefono && (!lead.telefono || String(lead.telefono).startsWith('mc_'))) updates.telefono = telefono;
    if (genero && !lead.genero) {
      const generoMap: Record<string, string> = { 'Hombre': 'm', 'Mujer': 'f', 'hombre': 'm', 'mujer': 'f' };
      updates.genero = generoMap[genero] || genero;
    }
    if (ciudadSede && !lead.ciudad) updates.ciudad = ciudadSede;
    if (fbp && !lead.fbp) updates.fbp = fbp;
    if (fbc && !lead.fbc) updates.fbc = fbc;

    // Guardar datos personales del formulario en preferencias
    const formExtras: string[] = [];
    if (dieta) formExtras.push(`Alimentación: ${dieta}`);
    if (alergias) formExtras.push(`Alergias: ${alergias}`);
    if (motivacion) formExtras.push(`Motivación: ${motivacion}`);
    if (fechaCurso) formExtras.push(`Curso fecha: ${fechaCurso}`);
    if (ciudadSede) formExtras.push(`Sede: ${ciudadSede}`);
    if (formExtras.length > 0) {
      const existingPref = lead.preferencias ? String(lead.preferencias) + '\n' : '';
      updates.preferencias = existingPref + '[Registro web] ' + formExtras.join(' | ');
    }

    // Siempre actualizar estos si vienen
    if (email && lead.email !== email) updates.email = email;

    if (Object.keys(updates).length > 0) {
      await supabase.from('leads').update(updates).eq('id', lead.id);
    }

    // Actualizar tabla contacts (Expediente Maestro del Cliente)
    const contactUpdates: Record<string, unknown> = {};
    if (dieta) contactUpdates.dieta = dieta;
    if (dieta) contactUpdates.alimentacion = dieta; // alimentacion = mismo campo
    if (alergias) contactUpdates.alergias = alergias;
    if (motivacion) contactUpdates.motivo_curso = motivacion;
    if (genero) contactUpdates.genero = genero;
    if (nombre) contactUpdates.nombre = nombre;
    if (apellido) contactUpdates.apellido = apellido;
    if (email) contactUpdates.email = email;
    if (telefono) contactUpdates.telefono = telefono;
    if (ciudadSede) contactUpdates.ciudad = ciudadSede;

    if (Object.keys(contactUpdates).length > 0) {
      // Buscar si ya existe un contacto para este lead (puede haber varios — tomar el primero)
      const { data: existingContacts } = await supabase.from('contacts')
        .select('id').eq('lead_id', lead.id).order('created_at', { ascending: true }).limit(1);
      if (existingContacts && existingContacts.length > 0) {
        // Actualizar el contact existente
        await supabase.from('contacts').update(contactUpdates).eq('id', existingContacts[0].id);
        // Limpiar duplicados si hay más de 1
        const { data: allContacts } = await supabase.from('contacts')
          .select('id').eq('lead_id', lead.id).order('created_at', { ascending: true });
        if (allContacts && allContacts.length > 1) {
          const idsToDelete = allContacts.slice(1).map(c => c.id);
          await supabase.from('contacts').delete().in('id', idsToDelete);
        }
      } else {
        await supabase.from('contacts').insert({
          lead_id: lead.id,
          ...contactUpdates,
        });
      }
    }

    // Merge lead data con updates para tener datos completos
    const enrichedLead = { ...lead, ...updates };

    // Cargar config CAPI
    const { data: capiConfigs } = await supabase.from('app_config')
      .select('key, value')
      .in('key', ['meta_pixel_id', 'meta_access_token', 'meta_test_event_code']);
    const configMap: Record<string, string> = {};
    capiConfigs?.forEach((c: { key: string; value: string }) => { configMap[c.key] = c.value; });
    const metaPixelId = configMap.meta_pixel_id || Deno.env.get('META_PIXEL_ID');
    const metaAccessToken = configMap.meta_access_token || Deno.env.get('META_ACCESS_TOKEN');

    // Enviar CompleteRegistration a Meta CAPI
    if (metaPixelId && metaAccessToken) {
      const eventTimestamp = Math.floor(Date.now() / 1000);

      await invokeFunction({
        functionName: 'meta-capi-sender', await: true, supabase,
        errorContext: `CompleteRegistration ${enrichedLead.nombre}`,
        body: {
          config: {
            pixel_id: metaPixelId,
            access_token: metaAccessToken,
            test_event_code: configMap.meta_test_event_code || undefined
          },
          eventData: {
            event_name: 'CompleteRegistration',
            event_id: `samurai_${lead.id}_completereg_${eventTimestamp}`,
            lead_id: lead.id,
            action_source: 'website',
            event_source_url: 'https://theelephantbowl.com/inscripciones-completa-tu-registro/',
            user_data: {
              em: enrichedLead.email || email,
              ph: enrichedLead.telefono || telefono,
              fn: enrichedLead.nombre || nombre,
              ln: enrichedLead.apellido || apellido,
              ct: enrichedLead.ciudad || ciudadSede,
              st: enrichedLead.estado,
              zp: enrichedLead.cp,
              ge: enrichedLead.genero,
              db: enrichedLead.fecha_nacimiento,
              external_id: String(lead.id),
              country: 'mx',
              fbc: enrichedLead.fbc || fbc || undefined,
              fbp: enrichedLead.fbp || fbp || undefined,
              ctwa_clid: enrichedLead.ctwa_clid || undefined,
              client_ip_address: clientIp || undefined,
              client_user_agent: clientUserAgent || undefined,
            },
            custom_data: {
              content_name: enrichedLead.servicio_interes || 'talleres_cuencoterapia',
              content_category: 'talleres_cuencoterapia',
              ciudad_sede: ciudadSede || undefined,
              fecha_curso: fechaCurso || undefined,
              source: 'samurai_form',
            }
          }
        }
      });
    }

    // NO enviar Purchase desde Samurai — Facebook for WooCommerce ya envía
    // Purchase via Pixel + CAPI con deduplicación correcta (mismo event_id).
    // Enviar otro Purchase desde aquí causaría duplicación en Meta.

    // Marcar como COMPRADO (sin enviar CAPI Purchase — WooCommerce ya lo hizo)
    if (lead.buying_intent !== 'COMPRADO') {
      await supabase.from('leads').update({
        buying_intent: 'COMPRADO',
        capi_lead_event_sent_at: new Date().toISOString(), // Flag para que analyze-leads/process-capi no re-envíe
      }).eq('id', lead.id);
    }

    await supabase.from('activity_logs').insert({
      action: 'UPDATE', resource: 'LEADS',
      description: `📋 Registro web completado: ${enrichedLead.nombre || nombre} (${email}). Datos actualizados: ${Object.keys(updates).join(', ') || 'ninguno'}`,
      status: 'OK'
    });

    // Guardar en conversaciones para que aparezca en el chat
    await supabase.from('conversaciones').insert({
      lead_id: lead.id,
      mensaje: `✅ Registro web completado. ${nombre} ${apellido} completó el formulario de inscripción.${ciudadSede ? ` Sede: ${ciudadSede}.` : ''}${fechaCurso ? ` Fecha: ${fechaCurso}.` : ''}`,
      emisor: 'SISTEMA',
      platform: 'PANEL_INTERNO',
      metadata: { source: 'form_webhook', fields_updated: Object.keys(updates) }
    });

    return new Response(JSON.stringify({
      status: 'ok',
      action: 'lead_updated',
      lead_id: String(lead.id),
      fields_updated: Object.keys(updates)
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[form-webhook] Error:', err);
    return new Response(JSON.stringify({ status: 'error', message: String(err) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
