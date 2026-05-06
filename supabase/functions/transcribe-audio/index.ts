// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  let _lead_id = null, _message_id = null;
  try {
    const { media_id, media_url, lead_id, message_id, channel_id, sender_phone, skip_ai } = await req.json();
    _lead_id = lead_id; _message_id = message_id;
    if ((!media_id && !media_url) || !lead_id || !message_id || !channel_id) {
      return new Response('missing_params', { headers: corsHeaders });
    }

    // 1. Obtener canal completo (api_key, provider, ai_mode, api_url, instance_id)
    const { data: channel } = await supabase.from('whatsapp_channels').select('api_key, provider, ai_mode, api_url, instance_id').eq('id', channel_id).single();
    if (!channel?.api_key) {
      await logAndFallback(supabase, lead_id, message_id, 'Canal no encontrado o sin api_key', false);
      return new Response('no_channel', { headers: corsHeaders });
    }
    // skip_ai=true se usa para transcribir audio SALIENTE (del vendedor) sin disparar respuesta IA al cliente
    const shouldInvokeAI = channel.ai_mode === 'on' && !skip_ai;

    // 2. Obtener OpenAI api_key
    const { data: configs } = await supabase.from('app_config').select('key, value');
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || configs?.find(c => c.key === 'openai_api_key')?.value;
    if (!openaiKey) {
      await logAndFallback(supabase, lead_id, message_id, 'OpenAI API Key no configurada', shouldInvokeAI);
      return new Response('no_openai_key', { headers: corsHeaders });
    }

    // 3. Descargar audio — dual-mode (Gowa 2-step download o Meta Graph API)
    let audioBlob;
    if (channel.provider === 'gowa' && message_id && sender_phone) {
      // Gowa: proceso de 2 pasos (ver manual sección 4)
      // Paso 1: Trigger descarga → GOWA guarda archivo en disco
      let baseUrl = channel.api_url || '';
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      const gowaHeaders = {
        'Authorization': channel.api_key?.startsWith('Basic ') ? channel.api_key : `Basic ${channel.api_key}`,
        'X-Device-Id': channel.instance_id || ''
      };

      let filePath = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const triggerRes = await fetch(`${baseUrl}/message/${message_id}/download?phone=${sender_phone}`, { headers: gowaHeaders });
          if (triggerRes.ok) {
            const triggerData = await triggerRes.json();
            if (triggerData.code === 'SUCCESS' && triggerData.results?.file_path) {
              filePath = triggerData.results.file_path;
              break;
            }
          }
        } catch (e) { console.error(`Gowa download trigger attempt ${attempt}:`, e); }
        if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * attempt));
      }

      if (!filePath) {
        await logAndFallback(supabase, lead_id, message_id, `Gowa 2-step download: trigger failed after 3 attempts for msg ${message_id}`, shouldInvokeAI);
        return new Response('download_error', { headers: corsHeaders });
      }

      // Paso 2: Descargar binario real desde file_path
      const fileRes = await fetch(`${baseUrl}/${filePath}`, { headers: gowaHeaders });
      if (!fileRes.ok) {
        await logAndFallback(supabase, lead_id, message_id, `Gowa 2-step download: file fetch failed (${fileRes.status}) from ${filePath}`, shouldInvokeAI);
        return new Response('download_error', { headers: corsHeaders });
      }
      audioBlob = await fileRes.blob();

      // Actualizar metadata en conversacion con URL real para playback en chatview
      const realUrl = `${baseUrl}/${filePath}`;
      await supabase.from('conversaciones').update({ metadata: { mediaUrl: realUrl, mediaType: 'audio', gowaAuth: true } }).eq('message_id', message_id);

    } else if (media_url && !media_id) {
      // Evolution/otro: URL directa
      const audioRes = await fetch(media_url);
      if (!audioRes.ok) {
        await logAndFallback(supabase, lead_id, message_id, `Audio download failed (${audioRes.status}) from ${media_url.substring(0, 80)}`, shouldInvokeAI);
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
        await logAndFallback(supabase, lead_id, message_id, `Meta Graph API error (${mediaRes.status}): ${errText.substring(0, 150)}`, shouldInvokeAI);
        return new Response('meta_error', { headers: corsHeaders });
      }
      const mediaData = await mediaRes.json();
      const audioUrl = mediaData.url;
      if (!audioUrl) {
        await logAndFallback(supabase, lead_id, message_id, 'Meta Graph API no devolvio URL de audio', shouldInvokeAI);
        return new Response('no_audio_url', { headers: corsHeaders });
      }
      const audioRes = await fetch(audioUrl, {
        headers: { 'Authorization': `Bearer ${channel.api_key}` }
      });
      if (!audioRes.ok) {
        await logAndFallback(supabase, lead_id, message_id, `Audio download failed (${audioRes.status})`, shouldInvokeAI);
        return new Response('download_error', { headers: corsHeaders });
      }
      audioBlob = await audioRes.blob();
    } else {
      await logAndFallback(supabase, lead_id, message_id, 'No media_id ni media_url proporcionados', shouldInvokeAI);
      return new Response('no_media', { headers: corsHeaders });
    }

    // S4.3: Verificar tamaño del audio (Whisper limite 25MB)
    const maxSize = 25 * 1024 * 1024;
    if (audioBlob.size > maxSize) {
      await logAndFallback(supabase, lead_id, message_id, `Audio demasiado grande (${(audioBlob.size / 1024 / 1024).toFixed(1)}MB, limite 25MB)`, shouldInvokeAI);
      return new Response('audio_too_large', { headers: corsHeaders });
    }

    // S4.4: Verificar que el blob es realmente audio (no HTML de error ni JSON)
    if (audioBlob.size < 500) {
      await logAndFallback(supabase, lead_id, message_id, `Audio sospechosamente pequeño (${audioBlob.size} bytes), posible error de descarga`, shouldInvokeAI);
      return new Response('audio_too_small', { headers: corsHeaders });
    }

    // 5. Transcribir con OpenAI Whisper
    // Detectar extensión correcta desde el tipo del blob
    const blobType = (audioBlob.type || 'audio/ogg').split(';')[0].trim();
    const extMap: Record<string, string> = { 'audio/ogg': 'audio.ogg', 'audio/mpeg': 'audio.mp3', 'audio/mp4': 'audio.m4a', 'audio/webm': 'audio.webm', 'audio/wav': 'audio.wav', 'audio/x-wav': 'audio.wav', 'audio/opus': 'audio.ogg', 'audio/aac': 'audio.m4a' };
    const fileName = extMap[blobType] || 'audio.ogg';
    const form = new FormData();
    form.append('file', audioBlob, fileName);
    form.append('model', 'whisper-1');
    form.append('language', 'es');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: form
    });
    if (!whisperRes.ok) {
      const errText = await whisperRes.text().catch(() => 'unknown');
      await logAndFallback(supabase, lead_id, message_id, `Whisper error (${whisperRes.status}): ${errText.substring(0, 150)}`, shouldInvokeAI);
      return new Response('whisper_error', { headers: corsHeaders });
    }
    const whisperData = await whisperRes.json();
    const transcription = whisperData.text?.trim();
    if (!transcription || transcription.length < 2) {
      await logAndFallback(supabase, lead_id, message_id, 'Whisper devolvio transcripcion vacia o muy corta', shouldInvokeAI);
      return new Response('empty_transcription', { headers: corsHeaders });
    }

    // Validar calidad: detectar artefactos de subtítulos/OCR que indican audio mal procesado
    const garbagePatterns = ['subtítulos realizados', 'amara.org', 'suscríbete', 'subscribe', 'like and share'];
    const lowerTranscription = transcription.toLowerCase();
    if (garbagePatterns.some(p => lowerTranscription.includes(p))) {
      await logAndFallback(supabase, lead_id, message_id, `Transcripcion contiene artefactos de subtítulos/OCR: "${transcription.substring(0, 80)}"`, shouldInvokeAI);
      return new Response('garbage_transcription', { headers: corsHeaders });
    }

    // 6. Actualizar conversacion con transcripcion real
    // Usar acento Ó para matchear el regex del UI (MessageList.tsx) — ambos variantes funcionan desde el fix 2026-04-10
    const transcribedMessage = `[TRANSCRIPCIÓN DE NOTA DE VOZ]: "${transcription}"`;
    await supabase.from('conversaciones').update({ mensaje: transcribedMessage }).eq('message_id', message_id);

    // 7. Invocar process-samurai-response solo si canal tiene IA activa
    if (shouldInvokeAI) {
      const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-samurai-response`;
      await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({ lead_id, client_message: transcription })
      });
    }

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

async function logAndFallback(supabase, lead_id, message_id, errorDesc, shouldInvokeAI = true) {
  const fallbackText = '[Nota de Voz — no se pudo transcribir]';

  // Actualizar mensaje con fallback
  await supabase.from('conversaciones').update({ mensaje: fallbackText }).eq('message_id', message_id);

  // Log del error
  await supabase.from('activity_logs').insert({
    action: 'ERROR', resource: 'BRAIN',
    description: `🎙️ Transcripcion fallida: ${errorDesc.substring(0, 200)}`,
    status: 'ERROR'
  });

  // Invocar AI con fallback solo si canal tiene IA activa
  if (shouldInvokeAI) {
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
}
