import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { invokeFunction } from '../_shared/invoke.ts'

/**
 * Messenger & Instagram DM webhook.
 * Receives messages from Facebook Messenger and Instagram Direct via Meta webhook.
 * Creates/finds leads, processes with AI, and replies via Graph API.
 */
serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  // GET = Meta webhook verification (hub.challenge)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token === 'samurai_v3' && challenge) {
      console.log('[messenger-webhook] Verification OK');
      return new Response(challenge, { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();

    // Meta sends { object: 'page' | 'instagram', entry: [...] }
    const objectType = payload.object; // 'page' for Messenger, 'instagram' for IG
    if (!payload.entry || !Array.isArray(payload.entry)) {
      return new Response('OK', { status: 200 });
    }

    for (const entry of payload.entry) {
      const pageId = entry.id; // Facebook Page ID or Instagram account ID
      const messaging = entry.messaging || entry.messages || [];

      for (const event of messaging) {
        // Skip non-message events (read receipts, deliveries, etc.)
        if (!event.message && !event.postback) continue;

        const senderId = event.sender?.id; // PSID (Page-Scoped User ID)
        if (!senderId) continue;

        // Skip messages sent by the page itself (echo)
        if (event.message?.is_echo) continue;

        const text = event.message?.text || event.postback?.payload || '';
        const attachments = event.message?.attachments || [];
        const messageId = event.message?.mid || null;
        const timestamp = event.timestamp;

        // Determine platform
        const platform = objectType === 'instagram' ? 'instagram' : 'messenger';

        console.log(`[messenger-webhook] ${platform} message from ${senderId} on page ${pageId}: "${text.substring(0, 50)}"`);

        // --- Get sender profile (name) ---
        let senderName = 'Lead ' + (platform === 'instagram' ? 'Instagram' : 'Messenger');
        const pageToken = await getPageToken(supabase, pageId);
        if (pageToken) {
          try {
            const profileUrl = platform === 'instagram'
              ? `https://graph.facebook.com/v21.0/${senderId}?fields=name,username&access_token=${pageToken}`
              : `https://graph.facebook.com/v21.0/${senderId}?fields=first_name,last_name,name&access_token=${pageToken}`;
            const profileRes = await fetch(profileUrl);
            if (profileRes.ok) {
              const profile = await profileRes.json();
              senderName = profile.name || profile.first_name || senderName;
            }
          } catch (e) {
            console.error('[messenger-webhook] Profile fetch error:', e);
          }
        }

        // --- Find or create lead ---
        const psidField = platform === 'instagram' ? 'instagram_psid' : 'messenger_psid';

        // Check if lead exists by PSID
        let { data: lead } = await supabase.from('leads')
          .select('*')
          .eq(psidField, senderId)
          .maybeSingle();

        if (!lead) {
          // Also try by placeholder phone
          const { data: leadByPhone } = await supabase.from('leads')
            .select('*')
            .eq('telefono', `${platform}:${senderId}`)
            .maybeSingle();

          if (leadByPhone) {
            lead = leadByPhone;
            // Update PSID if missing
            if (!leadByPhone[psidField]) {
              await supabase.from('leads').update({ [psidField]: senderId }).eq('id', lead.id);
            }
          } else {
            // Create new lead
            const { data: newLead, error: createErr } = await supabase.from('leads').insert({
              nombre: senderName,
              telefono: `${platform}:${senderId}`,
              [psidField]: senderId,
              origen_contacto: platform,
              buying_intent: 'BAJO',
              confidence_score: 0,
              ai_paused: false,
              estado_emocional_actual: 'NEUTRO',
            }).select('*').single();

            if (createErr) {
              console.error('[messenger-webhook] Lead create error:', createErr.message);
              continue;
            }
            lead = newLead;

            // Create contact linked to lead
            await supabase.from('contacts').insert({
              nombre: senderName,
              telefono: `${platform}:${senderId}`,
              lead_id: lead.id,
              origen_contacto: platform,
            }).then(() => {}).catch(() => {});

            await supabase.from('activity_logs').insert({
              action: 'CREATE', resource: 'LEADS',
              description: `Nuevo lead via ${platform}: ${senderName} (PSID: ${senderId})`,
              status: 'OK',
            }).then(() => {}).catch(() => {});
          }
        }

        // --- Store message in conversaciones ---
        await supabase.from('conversaciones').insert({
          lead_id: lead.id,
          emisor: 'CLIENTE',
          mensaje: text || (attachments.length > 0 ? `[${attachments[0]?.type || 'adjunto'}]` : ''),
          platform: platform.toUpperCase(),
          metadata: {
            psid: senderId,
            page_id: pageId,
            message_id: messageId,
            platform,
            attachments: attachments.map((a: any) => ({ type: a.type, url: a.payload?.url })),
          },
        });

        // Update last_message_at
        await supabase.from('leads').update({
          last_message_at: new Date().toISOString(),
          nombre: lead.nombre === `Lead ${platform === 'instagram' ? 'Instagram' : 'Messenger'}` ? senderName : lead.nombre,
        }).eq('id', lead.id);

        // --- Check if AI should respond ---
        if (lead.ai_paused) {
          console.log(`[messenger-webhook] AI paused for lead ${lead.id}, skipping`);
          continue;
        }

        // --- Process with AI and reply ---
        if (text && pageToken) {
          try {
            // Get context and generate AI response
            const contextResult = await invokeFunction({
              functionName: 'get-lead-context',
              body: { lead_id: lead.id },
              supabase,
              errorContext: `messenger-context lead=${lead.id}`,
              await: true,
            });

            if (contextResult?.ok && contextResult.data?.context) {
              // Call OpenAI directly for response
              const openaiKey = Deno.env.get('OPENAI_API_KEY');
              if (openaiKey) {
                const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    temperature: 0.7,
                    max_tokens: 500,
                    messages: [
                      { role: 'system', content: contextResult.data.context + `\n\nIMPORTANTE: Este lead llegó por ${platform}, NO por WhatsApp. No tienes su número de teléfono aún. Si es natural en la conversación, pídele su número de WhatsApp para poder atenderlo mejor.` },
                      { role: 'user', content: text },
                    ],
                  }),
                });

                if (aiRes.ok) {
                  const aiData = await aiRes.json();
                  const aiResponse = aiData.choices?.[0]?.message?.content;

                  if (aiResponse) {
                    // Store AI response in conversaciones
                    await supabase.from('conversaciones').insert({
                      lead_id: lead.id,
                      emisor: 'IA',
                      mensaje: aiResponse,
                      platform: platform.toUpperCase(),
                    });

                    // Send reply via Graph API
                    await sendMessengerReply(pageToken, senderId, aiResponse, platform);
                  }
                }
              }
            }
          } catch (aiErr) {
            console.error('[messenger-webhook] AI processing error:', aiErr);
          }
        }
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[messenger-webhook] Error:', err);
    await supabase.from('activity_logs').insert({
      action: 'ERROR', resource: 'BRAIN',
      description: `[messenger-webhook] ${(err as Error).message?.substring(0, 200)}`,
      status: 'ERROR',
    }).catch(() => {});
    return new Response('OK', { status: 200 }); // Always return 200 to Meta
  }
});

// --- Helper: Get page token for a given page ID ---
async function getPageToken(supabase: any, pageId: string): Promise<string | null> {
  // Check known page IDs
  const { data: configs } = await supabase.from('app_config')
    .select('key, value')
    .like('key', 'messenger_page_token_%');

  if (!configs) return null;

  // Also fetch page ID mappings
  const { data: pageIds } = await supabase.from('app_config')
    .select('key, value')
    .like('key', 'messenger_page_id_%');

  // Find which token corresponds to this page ID
  for (const pid of (pageIds || [])) {
    if (pid.value === pageId) {
      // Extract the suffix (e.g., 'elephant_bowl' from 'messenger_page_id_elephant_bowl')
      const suffix = pid.key.replace('messenger_page_id_', '');
      const tokenConfig = configs.find((c: any) => c.key === `messenger_page_token_${suffix}`);
      if (tokenConfig) return tokenConfig.value;
    }
  }

  // Fallback: return the first available token
  return configs[0]?.value || null;
}

// --- Helper: Send reply via Facebook Graph API ---
async function sendMessengerReply(pageToken: string, recipientId: string, message: string, platform: string): Promise<void> {
  try {
    const apiUrl = `https://graph.facebook.com/v21.0/me/messages?access_token=${pageToken}`;
    const body = {
      recipient: { id: recipientId },
      message: { text: message.substring(0, 2000) }, // Messenger limit is 2000 chars
      messaging_type: 'RESPONSE',
    };

    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[messenger-webhook] Send reply error (${res.status}): ${errText}`);
    } else {
      console.log(`[messenger-webhook] Reply sent to ${recipientId} via ${platform}`);
    }
  } catch (err) {
    console.error('[messenger-webhook] Send reply error:', err);
  }
}
