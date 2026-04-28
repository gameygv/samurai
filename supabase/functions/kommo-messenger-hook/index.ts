import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

/**
 * Kommo Webhook → Samurai AI
 * Receives "incoming message" webhooks from Kommo, processes with AI,
 * and replies via Kommo Chat API.
 *
 * This bridges Facebook Messenger + Instagram (connected in Kommo)
 * to the Samurai AI chatbot.
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method === 'GET') return new Response('OK', { status: 200 });

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    // Kommo sends form-urlencoded or JSON depending on the webhook type
    let payload: any;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      // Form-urlencoded — parse it
      const text = await req.text();
      const params = new URLSearchParams(text);
      payload = {};
      for (const [key, value] of params.entries()) {
        // Kommo sends nested keys like message[add][0][text]
        payload[key] = value;
      }
    }

    // Log the raw payload for debugging (first runs)
    console.log('[kommo-messenger-hook] Payload:', JSON.stringify(payload).substring(0, 500));

    await supabase.from('activity_logs').insert({
      action: 'INFO', resource: 'MESSENGER',
      description: '[kommo-hook] Webhook received',
      status: 'OK',
      metadata: payload,
    });

    // TODO: Parse Kommo webhook payload, extract message, find/create lead,
    // process with AI, reply via Kommo API.
    // For now, just log to verify the webhook is receiving data.

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('[kommo-messenger-hook] Error:', err);
    return new Response('OK', { status: 200 }); // Always 200 for webhooks
  }
});
