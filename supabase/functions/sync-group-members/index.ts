import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { appendAcademicRecord } from '../_shared/academic-record.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normaliza un teléfono mexicano para comparación.
 * GOWA devuelve "5214771172736" (con 1 después de 52).
 * La BD puede tener "524771172736" (sin 1) o "5214771172736" (con 1).
 * Retorna ambas variantes para buscar.
 */
function normalizePhoneMX(phone: string): string[] {
  const clean = phone.replace(/[^0-9]/g, '');
  const variants: string[] = [clean];

  // 521XXXXXXXXXX (13 dígitos) → también buscar sin el 1: 52XXXXXXXXXX
  if (clean.startsWith('521') && clean.length === 13) {
    variants.push('52' + clean.substring(3));
  }
  // 52XXXXXXXXXX (12 dígitos) → también buscar con el 1: 521XXXXXXXXXX
  if (clean.startsWith('52') && !clean.startsWith('521') && clean.length === 12) {
    variants.push('521' + clean.substring(2));
  }

  return variants;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { channel_id, group_jid, course_id } = await req.json();

    if (!channel_id || !group_jid) {
      return new Response(JSON.stringify({ error: 'channel_id y group_jid requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Obtener datos del canal
    const { data: channel, error: chErr } = await supabase
      .from('whatsapp_channels')
      .select('api_url, api_key, instance_id')
      .eq('id', channel_id)
      .single();

    if (chErr || !channel) {
      return new Response(JSON.stringify({ error: 'Canal no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Obtener participantes del grupo
    const authHeader = channel.api_key.startsWith('Basic ')
      ? channel.api_key
      : `Basic ${channel.api_key}`;

    const gowaRes = await fetch(
      `${channel.api_url}/group/participants?group_id=${encodeURIComponent(group_jid)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'X-Device-Id': channel.instance_id ?? '',
        },
      }
    );

    if (!gowaRes.ok) {
      const errText = await gowaRes.text();
      console.error(`[sync-group-members] GOWA ${gowaRes.status}: ${errText}`);
      return new Response(JSON.stringify({ error: `GOWA API error: ${gowaRes.status}` }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const gowaData = await gowaRes.json();
    const participants = gowaData?.results?.participants || [];
    const groupName = gowaData?.results?.name || '';

    // Obtener todos los contactos para cruzar
    const { data: allContacts } = await supabase
      .from('contacts')
      .select('id, telefono, nombre');

    const contactsByPhone = new Map<string, { id: string; nombre: string }>();
    for (const c of allContacts || []) {
      if (c.telefono) {
        const clean = c.telefono.replace(/[^0-9]/g, '');
        contactsByPhone.set(clean, { id: c.id, nombre: c.nombre });
      }
    }

    let matched = 0;
    let unmatched = 0;
    const upsertRows: any[] = [];
    const unmatchedMembers: any[] = [];

    for (const p of participants) {
      const phone = String(p.phone_number || '').replace(/[^0-9]/g, '');
      if (!phone) continue;

      const variants = normalizePhoneMX(phone);
      let foundContact: { id: string; nombre: string } | undefined;

      for (const v of variants) {
        foundContact = contactsByPhone.get(v);
        if (foundContact) break;
      }

      if (foundContact) {
        matched++;
        upsertRows.push({
          contact_id: foundContact.id,
          group_jid,
          group_name: groupName,
          course_id: course_id || null,
          channel_id,
          phone_number: phone,
          synced_at: new Date().toISOString(),
        });
      } else {
        // AUTO-CREATE: crear contact + lead para miembros no registrados
        const displayName = p.display_name || null;
        const phoneNorm = variants[0]; // usar la primera variante normalizada

        try {
          // INSERT contact (SELECT explícito, no tocar pos_*)
          const { data: newContact, error: cErr } = await supabase
            .from('contacts')
            .insert({
              nombre: displayName,
              telefono: phoneNorm,
              origen_contacto: 'auto-from-group',
            })
            .select('id')
            .single();

          if (cErr) {
            // Si ya existe por telefono (race condition), buscar
            const { data: existing } = await supabase
              .from('contacts')
              .select('id')
              .eq('telefono', phoneNorm)
              .maybeSingle();

            if (existing) {
              matched++;
              upsertRows.push({
                contact_id: existing.id,
                group_jid,
                group_name: groupName,
                course_id: course_id || null,
                channel_id,
                phone_number: phone,
                synced_at: new Date().toISOString(),
              });
              continue;
            }
            unmatched++;
            unmatchedMembers.push({ phone_number: phone, display_name: displayName || '' });
            continue;
          }

          // INSERT lead con ai_paused=TRUE (Sam NO responde hasta primer mensaje entrante)
          const { data: newLead } = await supabase
            .from('leads')
            .insert({
              telefono: phoneNorm,
              nombre: displayName,
              funnel_stage: 'INICIAL',
              buying_intent: 'BAJO',
              confidence_score: 0,
              origen: 'auto-from-group',
              ai_paused: true,
              estado_emocional_actual: 'NEUTRO',
            })
            .select('id')
            .single();

          // Link contact → lead
          if (newLead) {
            await supabase.from('contacts').update({ lead_id: newLead.id }).eq('id', newContact.id);
          }

          matched++;
          upsertRows.push({
            contact_id: newContact.id,
            group_jid,
            group_name: groupName,
            course_id: course_id || null,
            channel_id,
            phone_number: phone,
            synced_at: new Date().toISOString(),
          });
        } catch (autoErr) {
          console.error(`[sync-group-members] Auto-create error for ${phone}:`, autoErr);
          unmatched++;
          unmatchedMembers.push({ phone_number: phone, display_name: displayName || '' });
        }
      }
    }

    // Upsert en lotes
    if (upsertRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('contact_whatsapp_groups')
        .upsert(upsertRows, { onConflict: 'contact_id,group_jid' });

      if (upsertErr) {
        console.error('[sync-group-members] Upsert error:', upsertErr);
        return new Response(JSON.stringify({ error: `DB upsert error: ${upsertErr.message}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Limpiar miembros que ya no están en el grupo
    const currentPhones = participants
      .map((p: any) => String(p.phone_number || '').replace(/[^0-9]/g, ''))
      .filter(Boolean);

    if (currentPhones.length > 0) {
      const { data: existingRows } = await supabase
        .from('contact_whatsapp_groups')
        .select('id, phone_number')
        .eq('group_jid', group_jid);

      const toDelete = (existingRows || []).filter(
        (row) => row.phone_number && !currentPhones.some((cp: string) => {
          const variants = normalizePhoneMX(cp);
          const rowClean = row.phone_number.replace(/[^0-9]/g, '');
          return variants.includes(rowClean);
        })
      );

      if (toDelete.length > 0) {
        await supabase
          .from('contact_whatsapp_groups')
          .delete()
          .in('id', toDelete.map((r) => r.id));
      }
    }

    // S15.4: Autofill academic_record para contacts con course_id
    if (course_id && upsertRows.length > 0) {
      let academicAdded = 0;
      for (const row of upsertRows) {
        const result = await appendAcademicRecord(supabase, row.contact_id, course_id);
        if (result.added) academicAdded++;
      }
      console.log(`[sync-group-members] academic_record: ${academicAdded} added for course ${course_id}`);
    }

    console.log(`[sync-group-members] group=${group_jid} total=${participants.length} matched=${matched} unmatched=${unmatched}`);

    return new Response(JSON.stringify({
      synced: participants.length,
      matched,
      unmatched,
      group_name: groupName,
      unmatched_members: unmatchedMembers,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[sync-group-members] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
