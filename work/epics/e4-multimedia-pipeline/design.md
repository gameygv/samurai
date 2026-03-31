---
epic: E4
name: multimedia-pipeline
type: design
---

# E4 Design: Multimedia Pipeline

## Gemba (Current State)

### Audio Flow (broken)
```
WhatsApp Voice Note
  -> evolution-webhook: msg.type === 'audio' -> text = '[Nota de Voz]'
  -> conversaciones: mensaje = '[Nota de Voz]'
  -> process-samurai-response: AI recibe placeholder literal
  -> AI responde sin saber que dijo el cliente
```

### Image Flow (broken)
```
AI genera: "Mira este poster <<MEDIA:https://...jpg>>"
  -> process-samurai-response: envia aiText completo como texto
  -> send-message-v3: recibe { message: aiText } sin mediaData
  -> Cliente ve: "Mira este poster <<MEDIA:https://...jpg>>" (texto literal)
```

## Target State

### Audio Flow
```
WhatsApp Voice Note
  -> evolution-webhook: detecta audio, inserta placeholder, fire-and-forget
  -> transcribe-audio: download via Graph API -> Whisper -> transcripcion
  -> UPDATE conversaciones con transcripcion real
  -> process-samurai-response con texto transcrito
  -> AI responde al contenido real del audio
```

### Image Flow
```
AI genera: "Mira este poster <<MEDIA:https://...jpg>>"
  -> parser: extrae URL, limpia texto
  -> send-message-v3: { mediaData: { url, type: 'image' }, message: caption }
  -> Cliente ve: imagen con caption limpio
```

## Key Contracts

### transcribe-audio Input
```typescript
{
  media_id: string;      // msg.audio.id de Meta webhook
  lead_id: string;       // UUID del lead
  message_id: string;    // wamid del mensaje en conversaciones
  channel_id: string;    // UUID del canal (para obtener api_key)
}
```

### transcribe-audio Internal Flow
```typescript
// 1. Obtener api_key del canal
const { data: channel } = await supabase.from('whatsapp_channels')
  .select('api_key, provider').eq('id', channel_id).single();

// 2. Obtener URL temporal del audio (Meta Graph API)
const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${media_id}`, {
  headers: { Authorization: `Bearer ${channel.api_key}` }
});
const { url } = await mediaRes.json();

// 3. Descargar binario
const audioRes = await fetch(url, {
  headers: { Authorization: `Bearer ${channel.api_key}` }
});
const audioBlob = await audioRes.blob();

// 4. Transcribir con Whisper
const form = new FormData();
form.append('file', audioBlob, 'audio.ogg');
form.append('model', 'whisper-1');
form.append('language', 'es');

const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${openaiKey}` },
  body: form
});
const { text } = await whisperRes.json();

// 5. Actualizar conversacion
await supabase.from('conversaciones')
  .update({ mensaje: `[TRANSCRIPCION DE NOTA DE VOZ]: "${text}"` })
  .eq('message_id', message_id);

// 6. Invocar AI
await fetch(processUrl, { body: { lead_id, client_message: transcribedText } });
```

### Media Parser (inline in process-samurai-response)
```typescript
// Despues de obtener aiText (linea 125)
const mediaRegex = /<<MEDIA:(https?:\/\/[^>]+)>>/;
const mediaMatch = aiText.match(mediaRegex);
const cleanText = aiText.replace(/<<MEDIA:https?:\/\/[^>]+>>/g, '').trim();

if (mediaMatch) {
  const mediaUrl = mediaMatch[1];
  if (cleanText.length <= 1024) {
    // Imagen con caption
    await supabase.functions.invoke('send-message-v3', {
      body: { channel_id: lead.channel_id, phone: lead.telefono,
              message: cleanText, mediaData: { url: mediaUrl, type: 'image' },
              lead_id: lead.id }
    });
  } else {
    // Imagen sola + texto aparte
    await supabase.functions.invoke('send-message-v3', {
      body: { channel_id: lead.channel_id, phone: lead.telefono,
              message: '', mediaData: { url: mediaUrl, type: 'image' },
              lead_id: lead.id }
    });
    await supabase.functions.invoke('send-message-v3', {
      body: { channel_id: lead.channel_id, phone: lead.telefono,
              message: cleanText, lead_id: lead.id }
    });
  }
} else {
  // Flujo actual sin cambios
  await supabase.functions.invoke('send-message-v3', {
    body: { channel_id: lead.channel_id, phone: lead.telefono,
            message: aiText, lead_id: lead.id }
  });
}
```

## Components Touched

| Component | Change | Story |
|-----------|--------|-------|
| `supabase/functions/transcribe-audio/index.ts` | NEW — download + Whisper + update | S4.1 |
| `supabase/functions/evolution-webhook/index.ts` | ADD fire-and-forget call for audio | S4.1 |
| `supabase/functions/process-samurai-response/index.ts` | ADD media parser before send | S4.2 |
| `supabase/functions/send-message-v3/index.ts` | NO CHANGES (ya soporta mediaData) | — |
| `supabase/functions/get-samurai-context/index.ts` | NO CHANGES (ya tiene voice + media instructions) | — |
