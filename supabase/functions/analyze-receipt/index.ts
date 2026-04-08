// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

  try {
    const { image_id, media_url, lead_id, channel_id, caption } = await req.json();
    if ((!image_id && !media_url) || !lead_id || !channel_id) {
      return new Response('missing_params', { headers: corsHeaders });
    }

    // 1. Obtener api_key del canal
    const { data: channel } = await supabase.from('whatsapp_channels').select('api_key, provider').eq('id', channel_id).single();
    if (!channel?.api_key) {
      await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'BRAIN', description: `🔍 Ojo de Halcón: canal no encontrado para lead ${lead_id}`, status: 'ERROR' });
      return new Response('no_channel', { headers: corsHeaders });
    }

    // 2. Descargar imagen — S7.1: dual-mode (Meta Graph API o URL directa Gowa)
    let imageBlob;
    if (media_url) {
      // Gowa/Evolution: URL directa
      const imageRes = await fetch(media_url);
      if (!imageRes.ok) {
        await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'BRAIN', description: `🔍 Ojo de Halcón: descarga imagen falló (${imageRes.status}) from direct URL`, status: 'ERROR' });
        return new Response('download_error', { headers: corsHeaders });
      }
      imageBlob = await imageRes.blob();
    } else if (image_id) {
      // Meta: 2-step Graph API
      const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${image_id}`, {
        headers: { 'Authorization': `Bearer ${channel.api_key}` }
      });
      if (!mediaRes.ok) {
        const errText = await mediaRes.text().catch(() => 'unknown');
        await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'BRAIN', description: `🔍 Ojo de Halcón: Meta Graph API error (${mediaRes.status}): ${errText.substring(0, 100)}`, status: 'ERROR' });
        return new Response('meta_error', { headers: corsHeaders });
      }
      const mediaData = await mediaRes.json();
      const imageUrl = mediaData.url;
      if (!imageUrl) {
        return new Response('no_image_url', { headers: corsHeaders });
      }
      const imageRes = await fetch(imageUrl, {
        headers: { 'Authorization': `Bearer ${channel.api_key}` }
      });
      if (!imageRes.ok) {
        await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'BRAIN', description: `🔍 Ojo de Halcón: descarga imagen falló (${imageRes.status})`, status: 'ERROR' });
        return new Response('download_error', { headers: corsHeaders });
      }
      imageBlob = await imageRes.blob();
    } else {
      return new Response('no_media', { headers: corsHeaders });
    }
    const imageBuffer = await imageBlob.arrayBuffer();
    const bytes = new Uint8Array(imageBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const mimeType = imageBlob.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // 4. Analizar con GPT-4o Vision usando prompt_vision_instrucciones
    const { data: configs } = await supabase.from('app_config').select('key, value');
    const openaiKey = configs?.find(c => c.key === 'openai_api_key')?.value;
    const visionPrompt = configs?.find(c => c.key === 'prompt_vision_instrucciones')?.value
      || 'Analiza esta imagen con extremo detalle y precisión. Si es un COMPROBANTE DE PAGO: Extrae Banco, Monto transferido, Fecha y Referencia. Responde en texto plano.';

    if (!openaiKey) {
      await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'BRAIN', description: '🔍 Ojo de Halcón: OpenAI API Key no configurada', status: 'ERROR' });
      return new Response('no_openai_key', { headers: corsHeaders });
    }

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: visionPrompt },
            { type: 'image_url', image_url: { url: dataUrl } }
          ]
        }],
        max_tokens: 800,
        temperature: 0.1
      })
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => 'unknown');
      await supabase.from('activity_logs').insert({ action: 'ERROR', resource: 'BRAIN', description: `🔍 Ojo de Halcón: Vision API error (${aiRes.status}): ${errText.substring(0, 100)}`, status: 'ERROR' });
      return new Response('vision_error', { headers: corsHeaders });
    }

    const aiData = await aiRes.json();
    const analysis = aiData.choices?.[0]?.message?.content || 'No se pudo analizar la imagen.';

    // 5. Obtener datos del lead para la notificación
    const { data: lead } = await supabase.from('leads').select('nombre, assigned_to').eq('id', lead_id).single();

    // 6. Insertar nota interna en conversaciones (amarilla en el chat)
    await supabase.from('conversaciones').insert({
      lead_id,
      emisor: 'SISTEMA',
      mensaje: `🔍 Análisis Ojo de Halcón:\n${analysis}`,
      platform: 'PANEL_INTERNO',
      metadata: { author: 'Ojo de Halcón', type: 'receipt_analysis' }
    });

    // 7. Notificar al agente por WhatsApp (canal de notificaciones)
    if (lead?.assigned_to) {
      const { data: agent } = await supabase.from('profiles').select('phone, full_name').eq('id', lead.assigned_to).single();
      if (agent?.phone) {
        const msg = `🔍 Comprobante recibido de ${lead?.nombre || 'lead'}:\n\n${analysis.substring(0, 500)}`;
        await supabase.functions.invoke('send-message-v3', {
          body: { phone: agent.phone, message: msg }
        });
      }
    }

    // 8. Log de éxito
    await supabase.from('activity_logs').insert({
      action: 'UPDATE', resource: 'BRAIN',
      description: `🔍 Ojo de Halcón: comprobante analizado para ${lead?.nombre || lead_id}. ${analysis.substring(0, 100)}...`,
      status: 'OK'
    });

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[analyze-receipt] Error:', err);
    await supabase.from('activity_logs').insert({
      action: 'ERROR', resource: 'BRAIN',
      description: `🔍 Ojo de Halcón CRASH: ${err.message?.substring(0, 150)}`,
      status: 'ERROR'
    }).catch(() => {});
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
