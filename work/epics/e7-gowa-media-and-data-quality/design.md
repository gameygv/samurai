---
epic: E7
name: gowa-media-and-data-quality
type: design
---

# E7 Design: Gowa Media & Data Quality

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| D1 | Adaptar funciones para Gowa | Parametro dual: media_id O media_url |
| D2 | Datos expirados en KB | Limpiar ahora + valid_until en knowledge_documents |
| D3 | Recordatorios al cliente | Campo target 'agent' o 'client' con toggle UI |

## Key Contracts

### S7.1: Dual-mode media download

evolution-webhook (Gowa block) extracts:
```typescript
// Dentro del bloque else (Gowa/Evolution), linea ~110
const p = payload.payload || payload.data || payload;
const msgContent = p.message || {};

let audioMediaUrl = null;
let imageMediaUrl = null;

if (msgContent.audioMessage?.url) {
  audioMediaUrl = msgContent.audioMessage.url;
  text = '[Nota de Voz]';
}
if (msgContent.imageMessage?.url) {
  imageMediaUrl = msgContent.imageMessage.url;
  text = msgContent.imageMessage?.caption || '[Imagen]';
}
```

transcribe-audio y analyze-receipt reciben:
```typescript
// Input expandido
{
  media_id?: string;    // Meta: Graph API download
  media_url?: string;   // Gowa: URL directa
  lead_id: string;
  message_id: string;
  channel_id: string;
}

// Download logic
let audioBlob;
if (media_url) {
  // Gowa: download directo
  const res = await fetch(media_url);
  audioBlob = await res.blob();
} else if (media_id) {
  // Meta: 2-step Graph API
  const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${media_id}`, ...);
  const { url } = await mediaRes.json();
  const audioRes = await fetch(url, ...);
  audioBlob = await audioRes.blob();
}
```

### S7.2: valid_until en knowledge_documents

Migration:
```sql
ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS valid_until DATE;
```

Filter in get-samurai-context:
```typescript
const { data: kbDocs } = await supabaseClient
  .from('knowledge_documents')
  .select('title, category, content')
  .or(`valid_until.is.null,valid_until.gte.${today}`);
```

### S7.5: Reminder target field

Reminder object:
```typescript
{
  id: string,
  title: string,
  datetime: string,
  notify_minutes: number,
  notify_wa: boolean,
  target: 'agent' | 'client',  // NEW — default 'agent'
  sent?: boolean,
  sent_at?: string
}
```

process-lead-reminders logic:
```typescript
if (rem.target === 'client') {
  // Enviar al lead por su canal
  await supabase.functions.invoke('send-message-v3', {
    body: { lead_id: lead.id, phone: lead.telefono, message: rem.title }
  });
} else {
  // Enviar al agente por canal de notificaciones (como hoy)
  await supabase.functions.invoke('send-message-v3', {
    body: { phone: agent.phone, message: msg }
  });
}
```

## Components Touched

| Component | Change | Story |
|-----------|--------|-------|
| `supabase/functions/evolution-webhook/index.ts` | Extract media URLs from Gowa payload | S7.1 |
| `supabase/functions/transcribe-audio/index.ts` | Dual-mode: media_id OR media_url | S7.1 |
| `supabase/functions/analyze-receipt/index.ts` | Dual-mode: media_id OR media_url | S7.1 |
| `supabase/functions/get-samurai-context/index.ts` | Filter KB by valid_until | S7.2 |
| Migration SQL | valid_until on knowledge_documents | S7.2 |
| Cron SQL | Change schedule to */15 | S7.3 |
| `supabase/functions/process-lead-reminders/index.ts` | Support target: client | S7.5 |
| `src/components/chat/memory/ReminderItem.tsx` | Toggle for target | S7.5 |
