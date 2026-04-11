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
    // Bug-fix 2026-04-10: prompt incluye un marcador IS_RECEIPT: YES/NO para hacer early-exit
    // cuando la imagen no es un comprobante (evita llenar receipt_audits con fotos aleatorias).
    const { data: configs } = await supabase.from('app_config').select('key, value');
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || configs?.find(c => c.key === 'openai_api_key')?.value;
    const basePrompt = configs?.find(c => c.key === 'prompt_vision_instrucciones')?.value
      || 'Analiza esta imagen con extremo detalle y precisión. Si es un COMPROBANTE DE PAGO: Extrae Banco, Monto transferido, Fecha y Referencia. Responde en texto plano.';
    const visionPrompt = `PRIMERA LÍNEA OBLIGATORIA: escribe literalmente "IS_RECEIPT: YES" si la imagen es un comprobante bancario / ticket de transferencia / voucher de pago, o "IS_RECEIPT: NO" si es cualquier otra cosa (foto personal, screenshot de chat, meme, producto, captura aleatoria). Luego, en las siguientes líneas:\n\n${basePrompt}`;

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
    const rawAnalysis = aiData.choices?.[0]?.message?.content || 'No se pudo analizar la imagen.';

    // Early-exit: si GPT-4o determina que la imagen NO es un comprobante, no registrar nada.
    const firstLine = rawAnalysis.split('\n')[0].trim().toUpperCase();
    if (firstLine.includes('IS_RECEIPT: NO') || firstLine.includes('IS_RECEIPT:NO')) {
      await supabase.from('activity_logs').insert({
        action: 'INFO', resource: 'BRAIN',
        description: `🔍 Ojo de Halcón: imagen descartada (no es comprobante) lead=${lead_id}`,
        status: 'OK'
      }).catch(() => {});
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'not_a_receipt' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Limpiar el marcador IS_RECEIPT de la salida antes de guardarla
    const analysis = rawAnalysis.replace(/^IS_RECEIPT:\s*(YES|NO)\s*\n?/i, '').trim();

    // 5. Obtener datos del lead para la notificación
    const { data: lead } = await supabase.from('leads').select('nombre, assigned_to').eq('id', lead_id).single();

    // 5b. Comparar con cuentas bancarias registradas
    const bankKeys = ['bank_name', 'bank_account', 'bank_clabe', 'bank_holder'];
    const { data: bankConfigs } = await supabase.from('app_config').select('key, value').or(
      bankKeys.map(k => `key.eq.${k}`).join(',') + `,key.like.agent_bank_%`
    );

    let matchedAccount = '';
    let verdict = 'INCONCLUSIVE';
    const analysisLower = analysis.toLowerCase();

    // Check main account
    const mainBank = bankConfigs?.find(c => c.key === 'bank_name')?.value || '';
    const mainAccount = bankConfigs?.find(c => c.key === 'bank_account')?.value || '';
    const mainClabe = bankConfigs?.find(c => c.key === 'bank_clabe')?.value || '';

    if (mainBank && analysisLower.includes(mainBank.toLowerCase())) { matchedAccount = 'Cuenta Principal'; verdict = 'PROBABLE_VALID'; }
    else if (mainAccount && analysisLower.includes(mainAccount.slice(-4))) { matchedAccount = 'Cuenta Principal'; verdict = 'PROBABLE_VALID'; }
    else if (mainClabe && analysisLower.includes(mainClabe.slice(-4))) { matchedAccount = 'Cuenta Principal'; verdict = 'PROBABLE_VALID'; }

    // Check agent accounts
    if (!matchedAccount) {
      const agentBanks = bankConfigs?.filter(c => c.key.startsWith('agent_bank_')) || [];
      for (const ab of agentBanks) {
        try {
          const parsed = JSON.parse(ab.value);
          if (!parsed.enabled) continue;
          if (parsed.bank_name && analysisLower.includes(parsed.bank_name.toLowerCase())) {
            matchedAccount = `Cuenta de agente (${parsed.bank_name})`; verdict = 'PROBABLE_VALID'; break;
          }
          if (parsed.bank_account && analysisLower.includes(parsed.bank_account.slice(-4))) {
            matchedAccount = `Cuenta de agente (${parsed.bank_name || 'sin nombre'})`; verdict = 'PROBABLE_VALID'; break;
          }
        } catch (_) {}
      }
    }

    // Extract amounts/bank from analysis text for audit record
    const amountMatch = analysis.match(/\$?([\d,]+\.?\d*)/);
    const bankMatch = analysis.match(/(?:banco|bank)[:\s]*([^\n,]+)/i);
    const refMatch = analysis.match(/(?:referencia|ref|folio)[:\s]*([^\n,]+)/i);
    const dateMatch = analysis.match(/(?:fecha|date)[:\s]*([^\n,]+)/i);

    // Build human-readable note with disclaimer
    const aiNote = `Cuenta detectada: ${matchedAccount || 'No identificada'}\nVeredicto IA: ${verdict === 'PROBABLE_VALID' ? 'Probable depósito válido' : 'No concluyente'}\n\n⚠️ IMPORTANTE: Esta es una revisión automática de IA. El comprobante DEBE ser verificado manualmente por un humano antes de confirmar el pago.`;

    // Store image URL for audit (use media_url or construct from image_id)
    const auditImageUrl = media_url || `meta:${image_id}`;

    // 6. Insert into receipt_audits table
    const { data: auditRecord } = await supabase.from('receipt_audits').insert({
      lead_id,
      image_url: auditImageUrl,
      ai_analysis: analysis,
      ai_verdict: verdict,
      matched_account: matchedAccount || 'No identificada',
      bank_detected: bankMatch?.[1]?.trim() || '',
      amount_detected: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0,
      reference_detected: refMatch?.[1]?.trim() || '',
      date_detected: dateMatch?.[1]?.trim() || '',
      ai_note: aiNote,
      channel_id,
    }).select('id').single();

    // 7. Insertar nota interna en conversaciones (amarilla en el chat)
    const { data: convRecord } = await supabase.from('conversaciones').insert({
      lead_id,
      emisor: 'SISTEMA',
      mensaje: `🔍 Análisis Ojo de Halcón:\n${analysis}\n\n${aiNote}`,
      platform: 'PANEL_INTERNO',
      metadata: { author: 'Ojo de Halcón', type: 'receipt_analysis', audit_id: auditRecord?.id || null }
    }).select('id').single();

    // Update audit with conversation link
    if (auditRecord?.id && convRecord?.id) {
      await supabase.from('receipt_audits').update({ conversation_id: convRecord.id }).eq('id', auditRecord.id);
    }

    // 8. Notificar al agente por WhatsApp
    if (lead?.assigned_to) {
      const { data: agent } = await supabase.from('profiles').select('phone, full_name').eq('id', lead.assigned_to).single();
      if (agent?.phone) {
        const msg = `🔍 Comprobante recibido de ${lead?.nombre || 'lead'}:\n\n${analysis.substring(0, 300)}\n\n${aiNote}`;
        await supabase.functions.invoke('send-message-v3', {
          body: { phone: agent.phone, message: msg }
        });
      }
    }

    // 9. Log de éxito
    await supabase.from('activity_logs').insert({
      action: 'UPDATE', resource: 'BRAIN',
      description: `🔍 Ojo de Halcón: comprobante analizado para ${lead?.nombre || lead_id}. Veredicto: ${verdict}. ${matchedAccount || 'Sin coincidencia'}`,
      status: 'OK'
    });

    return new Response(JSON.stringify({ success: true, analysis, verdict, matched_account: matchedAccount, audit_id: auditRecord?.id }), {
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
