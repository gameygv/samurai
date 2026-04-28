import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { invokeFunction } from '../_shared/invoke.ts'

/**
 * Kommo Webhook → Samurai AI
 * Receives "incoming message" webhooks from Kommo (Facebook Messenger / Instagram),
 * processes with AI, and replies via Kommo Chats API.
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method === 'GET') return new Response('OK', { status: 200 });

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    // Parse form-urlencoded payload from Kommo
    const text = await req.text();
    const params = new URLSearchParams(text);
    const payload: Record<string, string> = {};
    for (const [key, value] of params.entries()) {
      payload[key] = value;
    }

    // Extract key fields from Kommo webhook
    // Kommo sends: unsorted[update][0][source_data][data][0][text] for message text
    const messageText = payload['unsorted[update][0][source_data][data][0][text]'] || '';
    const senderName = payload['unsorted[update][0][source_data][name]'] || payload['unsorted[update][0][data][contacts][0][name]'] || '';
    const service = payload['unsorted[update][0][source_data][service]'] || ''; // 'facebook' or 'instagram'
    const sourceName = payload['unsorted[update][0][source_data][source_name]'] || '';
    const chatId = payload['unsorted[update][0][source_data][origin][chat_id]'] || '';
    const clientPsid = payload['unsorted[update][0][source_data][client][id]'] || '';
    const kommoLeadId = payload['unsorted[update][0][data][leads][0][id]'] || '';
    const kommoContactId = payload['unsorted[update][0][data][contacts][0][id]'] || '';
    const talkId = payload['unsorted[update][0][data][contacts][0][talk_id]'] || '';
    const kommoAccountId = payload['account[id]'] || '';

    // Skip if no message text (could be a lead update, not a message)
    if (!messageText) {
      return new Response('OK', { status: 200 });
    }

    // Skip messages from manager (manager field = non-zero means outgoing)
    const managerId = payload['unsorted[update][0][source_data][data][0][manager]'] || '0';
    if (managerId !== '0') {
      return new Response('OK', { status: 200 });
    }

    const platform = service === 'instagram' ? 'instagram' : 'messenger';
    const psidField = platform === 'instagram' ? 'instagram_psid' : 'messenger_psid';

    console.log(`[kommo-hook] ${platform} message from ${senderName}: "${messageText.substring(0, 80)}"`);

    // --- Find or create lead in Samurai ---
    let { data: lead } = await supabase.from('leads')
      .select('*')
      .eq(psidField, clientPsid)
      .maybeSingle();

    if (!lead) {
      // Try by kommo_id
      if (kommoLeadId) {
        const { data: byKommo } = await supabase.from('leads')
          .select('*')
          .eq('kommo_id', parseInt(kommoLeadId))
          .maybeSingle();
        if (byKommo) {
          lead = byKommo;
          // Update PSID
          await supabase.from('leads').update({ [psidField]: clientPsid }).eq('id', lead.id);
        }
      }
    }

    if (!lead) {
      // Create new lead
      const { data: newLead, error: createErr } = await supabase.from('leads').insert({
        nombre: senderName,
        telefono: `${platform}:${clientPsid}`,
        [psidField]: clientPsid,
        kommo_id: kommoLeadId ? parseInt(kommoLeadId) : null,
        origen_contacto: platform,
        buying_intent: 'BAJO',
        confidence_score: 0,
        ai_paused: false,
        estado_emocional_actual: 'NEUTRO',
      }).select('*').single();

      if (createErr) {
        // May already exist by telefono — try to find
        const { data: existing } = await supabase.from('leads')
          .select('*')
          .eq('telefono', `${platform}:${clientPsid}`)
          .maybeSingle();
        lead = existing;
        if (lead && !lead[psidField]) {
          await supabase.from('leads').update({ [psidField]: clientPsid }).eq('id', lead.id);
        }
      } else {
        lead = newLead;
        // Create contact
        await supabase.from('contacts').insert({
          nombre: senderName,
          telefono: `${platform}:${clientPsid}`,
          lead_id: lead!.id,
          origen_contacto: platform,
        }).then(() => {}).catch(() => {});
      }
    }

    if (!lead) {
      console.error('[kommo-hook] Could not find or create lead');
      return new Response('OK', { status: 200 });
    }

    // Update last_message_at
    await supabase.from('leads').update({
      last_message_at: new Date().toISOString(),
    }).eq('id', lead.id);

    // --- Store message in conversaciones ---
    await supabase.from('conversaciones').insert({
      lead_id: lead.id,
      emisor: 'CLIENTE',
      mensaje: messageText,
      platform: platform.toUpperCase(),
      metadata: {
        source: 'kommo',
        service,
        psid: clientPsid,
        chat_id: chatId,
        talk_id: talkId,
        kommo_lead_id: kommoLeadId,
        kommo_contact_id: kommoContactId,
        source_name: sourceName,
      },
    });

    // --- Check if AI should respond ---
    if (lead.ai_paused) {
      console.log(`[kommo-hook] AI paused for lead ${lead.id}`);
      return new Response('OK', { status: 200 });
    }

    // --- Generate AI response ---
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      console.error('[kommo-hook] No OPENAI_API_KEY');
      return new Response('OK', { status: 200 });
    }

    // Get context
    const contextResult = await invokeFunction({
      functionName: 'get-lead-context',
      body: { lead_id: lead.id },
      supabase,
      errorContext: `kommo-context lead=${lead.id}`,
      await: true,
    });

    const context = contextResult?.data?.context || 'Eres un asistente de ventas amable para The Elephant Bowl, una comunidad de cuencoterapia.';

    // Generate response
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: context + `\n\nIMPORTANTE: Este lead llegó por ${platform === 'instagram' ? 'Instagram DM' : 'Facebook Messenger'}, NO por WhatsApp. No tienes su número de teléfono. Si es natural en la conversación, pídele su número de WhatsApp para poder atenderlo mejor y enviarle información de los cursos.`
          },
          { role: 'user', content: messageText },
        ],
      }),
    });

    if (!aiRes.ok) {
      console.error('[kommo-hook] OpenAI error:', await aiRes.text());
      return new Response('OK', { status: 200 });
    }

    const aiData = await aiRes.json();
    const aiResponse = aiData.choices?.[0]?.message?.content;

    if (!aiResponse) {
      return new Response('OK', { status: 200 });
    }

    // Store AI response
    await supabase.from('conversaciones').insert({
      lead_id: lead.id,
      emisor: 'IA',
      mensaje: aiResponse,
      platform: platform.toUpperCase(),
    });

    // --- Send reply via Kommo Chats API ---
    const { data: kommoToken } = await supabase.from('app_config')
      .select('value')
      .eq('key', 'kommo_api_token')
      .maybeSingle();

    if (kommoToken?.value && talkId && kommoAccountId) {
      try {
        // Kommo uses talk_id to send messages back to the conversation
        const kommoUrl = `https://theelephantbowl.kommo.com/api/v4/leads/${kommoLeadId}/notes`;
        const noteRes = await fetch(kommoUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${kommoToken.value}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([{
            note_type: 'common',
            params: { text: `[Samurai IA] ${aiResponse}` },
          }]),
        });

        // Also try to send via chat
        // The proper way is via amojo API, but that requires the scope_id
        // For now, log that we need to send
        if (!noteRes.ok) {
          console.error('[kommo-hook] Kommo note error:', await noteRes.text());
        }

        // Send directly via Messenger Graph API as fallback
        const pageToken = await getPageTokenForSource(supabase, sourceName);
        if (pageToken && clientPsid) {
          const graphRes = await fetch(`https://graph.facebook.com/v21.0/me/messages?access_token=${pageToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: clientPsid },
              message: { text: aiResponse.substring(0, 2000) },
              messaging_type: 'RESPONSE',
            }),
          });

          if (graphRes.ok) {
            console.log(`[kommo-hook] Reply sent via Graph API to ${senderName}`);
          } else {
            const errText = await graphRes.text();
            console.error(`[kommo-hook] Graph API error: ${errText}`);
            // If Graph API fails (permissions), at least the note is in Kommo
          }
        }
      } catch (sendErr) {
        console.error('[kommo-hook] Send error:', sendErr);
      }
    }

    await supabase.from('activity_logs').insert({
      action: 'INFO', resource: 'MESSENGER',
      description: `[kommo-hook] ${platform} de ${senderName}: "${messageText.substring(0, 50)}" → IA respondió`,
      status: 'OK',
    }).then(() => {}).catch(() => {});

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[kommo-messenger-hook] Error:', err);
    return new Response('OK', { status: 200 });
  }
});

async function getPageTokenForSource(supabase: any, sourceName: string): Promise<string | null> {
  // Map source name to token key
  const keyMap: Record<string, string> = {
    'The Elephant Bowl': 'messenger_page_token_elephant_bowl',
    'Tepoz Cuencos Coyoacán': 'messenger_page_token_tepoz_cuencos',
    'Tepoz Cuencos Coyoacan': 'messenger_page_token_tepoz_cuencos',
  };

  const configKey = keyMap[sourceName];
  if (configKey) {
    const { data } = await supabase.from('app_config').select('value').eq('key', configKey).maybeSingle();
    return data?.value || null;
  }

  // Fallback: return first available
  const { data } = await supabase.from('app_config').select('value').like('key', 'messenger_page_token_%').limit(1).maybeSingle();
  return data?.value || null;
}
