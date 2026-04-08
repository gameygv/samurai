// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  let _lead_id = null, _message_id = null;
  try {
    const { media_id, media_url, lead_id, message_id, channel_id } = await req.json();
    _lead_id = lead_id; _message_id = message_id;
    if ((!media_id && !media_url) || !lead_id || !message_id || !channel_id) {
      return new Response('missing_params', { headers: corsHeaders });
    }

    // 1. Obtener api_key del canal
    const { data: channel } = await supabase.from('whatsapp_channels').select('api_key, provider').eq('id', channel_id).single();
    if (!channel?.api_key) {
      await logAndFallback(supabase, lead_id, message_id, 'Canal no encontrado o sin api_key');
      return new Response('no_channel', { headers: corsHeaders });
    }

    // 2. Obtener OpenAI api_key
    const { data: configs } = await supabase.from('app_config').select('key, value');
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || configs?.find(c => c.key === 'openai_api_key')?.value;
    if (!openaiKey) {
      await logAndFallback(supabase, lead_id, message_id, 'OpenAI API Key no configurada');
      return new Response('no_openai_key', { headers: corsHeaders });
    }

    // 3. Descargar audio — S7.1: dual-mode (Meta Graph API o URL directa Gowa)
    let audioBlob;
    if (media_url) {
      // Gowa/Evolution: URL directa
      const audioRes = await fetch(media_url);
      if (!audioRes.ok) {
        await logAndFallback(supabase, lead_id, message_id, `Audio download failed (${audioRes.status}) from direct URL`);
        return new Response('download_error', { headers: corsHeaders });
      }
      audioBlob = await audioRes.blob();
    } else if (media_id) {
      // Meta: 2-step Graph API
      const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${media_id}`, {
        headers: { 'Authorization': `Bearer ${channel.api_key}` }
      });
      if (!mediaRes.ok) {
        const errText = await mediaRes.text().catch(() => 'unknown');
        await logAndFallback(supabase, lead_id, message_id, `Meta Graph API error (${mediaRes.status}): ${errText.substring(0, 150)}`);
        return new Response('meta_error', { headers: corsHeaders });
      }
      const mediaData = await mediaRes.json();
      const audioUrl = mediaData.url;
      if (!audioUrl) {
        await logAndFallback(supabase, lead_id, message_id, 'Meta Graph API no devolvio URL de audio');
        return new Response('no_audio_url', { headers: corsHeaders });
      }
      const audioRes = await fetch(audioUrl, {
        headers: { 'Authorization': `Bearer ${channel.api_key}` }
      });
      if (!audioRes.ok) {
        await logAndFallback(supabase, lead_id, message_id, `Audio download failed (${audioRes.status})`);
        return new Response('download_error', { headers: corsHeaders });
      }
      audioBlob = await audioRes.blob();
    } else {
      await logAndFallback(supabase, lead_id, message_id, 'No media_id ni media_url proporcionados');
      return new Response('no_media', { headers: corsHeaders });
    }

    // S4.3: Verificar tamaño del audio (Whisper limite 25MB)
    const maxSize = 25 * 1024 * 1024;
    if (audioBlob.size > maxSize) {
      await logAndFallback(supabase, lead_id, message_id, `Audio demasiado grande (${(audioBlob.size / 1024 / 1024).toFixed(1)}MB, limite 25MB)`);
      return new Response('audio_too_large', { headers: corsHeaders });
    }

    // 5. Transcribir con OpenAI Whisper
    const form = new FormData();
    form.append('file', audioBlob, 'audio.ogg');
    form.append('model', 'whisper-1');
    form.append('language', 'es');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: form
    });
    if (!whisperRes.ok) {
      const errText = await whisperRes.text().catch(() => 'unknown');
      await logAndFallback(supabase, lead_id, message_id, `Whisper error (${whisperRes.status}): ${errText.substring(0, 150)}`);
      return new Response('whisper_error', { headers: corsHeaders });
    }
    const whisperData = await whisperRes.json();
    const transcription = whisperData.text;
    if (!transcription) {
      await logAndFallback(supabase, lead_id, message_id, 'Whisper devolvio transcripcion vacia');
      return new Response('empty_transcription', { headers: corsHeaders });
    }

    // 6. Actualizar conversacion con transcripcion real
    const transcribedMessage = `[TRANSCRIPCION DE NOTA DE VOZ]: "${transcription}"`;
    await supabase.from('conversaciones').update({ mensaje: transcribedMessage }).eq('message_id', message_id);

    // 7. Invocar process-samurai-response con texto real
    const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-samurai-response`;
    await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ lead_id, client_message: transcription })
    });

    await supabase.from('activity_logs').insert({
      action: 'UPDATE', resource: 'BRAIN',
      description: `🎙️ Audio transcrito para Lead ${lead_id}: "${transcription.substring(0, 80)}..."`,
      status: 'OK'
    });

    return new Response(JSON.stringify({ success: true, transcription }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    // Crash total: usar variables capturadas al inicio (req.clone() no funciona aquí porque body ya fue consumido)
    try {
      if (_lead_id && _message_id) {
        await logAndFallback(supabase, _lead_id, _message_id, `CRASH transcribe-audio: ${err.message}`);
      }
    } catch (_) {}
    return new Response(err.message, { status: 200, headers: corsHeaders });
  }
})

async function logAndFallback(supabase, lead_id, message_id, errorDesc) {
  const fallbackText = '[Nota de Voz — no se pudo transcribir]';

  // Actualizar mensaje con fallback
  await supabase.from('conversaciones').update({ mensaje: fallbackText }).eq('message_id', message_id);

  // Log del error
  await supabase.from('activity_logs').insert({
    action: 'ERROR', resource: 'BRAIN',
    description: `🎙️ Transcripcion fallida: ${errorDesc.substring(0, 200)}`,
    status: 'ERROR'
  });

  // Invocar AI con fallback para que bot pida repetir (D3)
  try {
    const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-samurai-response`;
    await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify({ lead_id, client_message: fallbackText })
    });
  } catch (_) {}
}
