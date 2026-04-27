import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(baseMs: number, jitterMs: number): number {
  return baseMs + Math.floor(Math.random() * jitterMs * 2) - jitterMs;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { channel_id, recipients, delay_base_seconds = 20, campaign_name } = await req.json();

    // recipients: Array<{ phone: string, message: string, contact_name?: string }>
    if (!channel_id || !Array.isArray(recipients) || recipients.length === 0) {
      return new Response(JSON.stringify({ error: 'channel_id y recipients[] requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (recipients.length > 200) {
      return new Response(JSON.stringify({ error: 'Máximo 200 destinatarios por lote' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: channel, error: chErr } = await supabase
      .from('whatsapp_channels')
      .select('api_url, api_key, instance_id, provider, name')
      .eq('id', channel_id)
      .single();

    if (chErr || !channel) {
      return new Response(JSON.stringify({ error: 'Canal no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (channel.provider !== 'gowa') {
      return new Response(JSON.stringify({ error: 'Solo canales GOWA soportados' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = channel.api_key.startsWith('Basic ')
      ? channel.api_key
      : `Basic ${channel.api_key}`;

    const baseHeaders: Record<string, string> = {
      'Authorization': authHeader,
      'X-Device-Id': channel.instance_id ?? '',
      'Content-Type': 'application/json',
    };

    const results: Array<{ phone: string; status: 'sent' | 'error'; error?: string }> = [];
    const delayMs = Math.max(delay_base_seconds, 10) * 1000;
    const jitterMs = 5000; // ±5 seconds

    for (let i = 0; i < recipients.length; i++) {
      const { phone, message } = recipients[i];
      if (!phone || !message) {
        results.push({ phone: phone || 'unknown', status: 'error', error: 'phone/message faltante' });
        continue;
      }

      // Format phone for GOWA: ensure @s.whatsapp.net
      const formattedPhone = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;

      try {
        const gowaRes = await fetch(`${channel.api_url}/send/message`, {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({ phone: formattedPhone, message }),
        });

        if (!gowaRes.ok) {
          const errText = await gowaRes.text();
          console.error(`[send-campaign-individual] GOWA ${gowaRes.status} for ${phone}: ${errText}`);
          results.push({ phone, status: 'error', error: `HTTP ${gowaRes.status}` });
        } else {
          results.push({ phone, status: 'sent' });
        }
      } catch (err) {
        console.error(`[send-campaign-individual] Error sending to ${phone}:`, err);
        results.push({ phone, status: 'error', error: (err as Error).message });
      }

      // Delay between messages (skip after last)
      if (i < recipients.length - 1) {
        const waitMs = randomDelay(delayMs, jitterMs);
        console.log(`[send-campaign-individual] Waiting ${Math.round(waitMs / 1000)}s before next...`);
        await sleep(waitMs);
      }
    }

    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status === 'error').length;

    // Log to activity_logs
    await supabase.from('activity_logs').insert({
      action: 'CAMPAIGN_INDIVIDUAL_SEND',
      resource: 'CAMPAIGNS',
      description: `Campaña individual "${campaign_name || 'Sin nombre'}": ${sent} enviados, ${failed} fallidos de ${recipients.length} via ${channel.name}`,
      status: failed === 0 ? 'OK' : 'PARTIAL',
      metadata: {
        channel_id,
        total: recipients.length,
        sent,
        failed,
        delay_base_seconds,
        campaign_name: campaign_name || null,
      },
    }).catch((err: unknown) => console.error('[send-campaign-individual] Log error:', err));

    console.log(`[send-campaign-individual] Complete: ${sent}/${recipients.length} sent, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      total: recipients.length,
      sent,
      failed,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[send-campaign-individual] Error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
