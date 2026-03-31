---
epic: E6
name: chatbot-intelligence
type: design
---

# E6 Design: Chatbot Intelligence

## Gemba (Current State)

### Ojo de Halcón (broken)
```
Cliente envia imagen de comprobante por WhatsApp
  → evolution-webhook: msg.type === 'image', text = '[Imagen]'
  → process-samurai-response: AI responde al placeholder
  → scrape-website (VISION) NUNCA se invoca
  → Comprobante no analizado, agente no notificado
```

### Verdad Maestra cron (broken)
```
scrape-main-website existe y funciona manualmente
  → Ningun cron lo ejecuta automaticamente
  → Contenido del sitio web se desactualiza
```

### CAPI auto (broken)
```
analyze-leads detecta cambio de intent (BAJO→MEDIO)
  → Actualiza leads.buying_intent
  → meta-capi-sender NUNCA se invoca
  → Meta Pixel no recibe eventos de conversion
```

### OCR en contexto (broken)
```
media_assets.ocr_content tiene texto extraido de posters
  → get-samurai-context carga title, url, ai_instructions
  → ocr_content NO se incluye
  → AI no puede usar datos detallados del poster
```

## Target State

### Ojo de Halcón
```
Cliente envia imagen + contexto indica pago
  → evolution-webhook detecta imagen + extrae image_id
  → Guarda imageMediaId si buying_intent === 'ALTO'
    o texto contiene frases de pago
  → Fire-and-forget a nueva funcion analyze-receipt
  → analyze-receipt: descarga imagen de Meta Graph API,
    invoca scrape-website VISION, extrae datos
  → Inserta nota interna en conversaciones (amarilla)
  → Notifica al agente por WhatsApp (canal notificaciones)
```

### Verdad Maestra cron
```
Cron diario 3am UTC (09:00 PM Mexico)
  → Invoca scrape-main-website
  → Actualiza main_website_content para todas las URLs
  → Log en activity_logs
```

### CAPI auto
```
analyze-leads detecta cambio de intent
  → Si intent anterior < nuevo intent (subio):
    BAJO→MEDIO o BAJO→ALTO: evento "Lead"
    MEDIO→ALTO: evento "Lead" (qualified)
  → Invoca meta-capi-sender con datos del lead
  → Event ID unico: samurai_lead_{lead_id}_{intent}

Pipeline/webhook marca lead como COMPRADO
  → Evento "Purchase" con valor del producto
  → Event ID: samurai_purchase_{lead_id}
```

### OCR en contexto
```
get-samurai-context carga media_assets
  → Si ocr_content existe, incluir despues de ai_instructions
  → Formato: "- Titulo: instrucciones -> <<MEDIA:url>>\n  DETALLE: ocr_content"
```

## Key Contracts

### analyze-receipt (nueva edge function)

Input:
```typescript
{
  image_id: string;     // msg.image.id de Meta webhook
  lead_id: string;
  channel_id: string;
  caption: string;      // caption de la imagen si existe
}
```

Flow:
```typescript
// 1. Descargar imagen de Meta Graph API (mismo patron que transcribe-audio)
const mediaRes = await fetch(`https://graph.facebook.com/v21.0/${image_id}`, {
  headers: { Authorization: `Bearer ${channel.api_key}` }
});
const { url } = await mediaRes.json();

// 2. Invocar scrape-website en modo VISION
const { data } = await supabase.functions.invoke('scrape-website', {
  body: { url, mode: 'VISION', assetCategory: 'RECEIPT' }
});

// 3. Insertar nota interna en conversaciones
await supabase.from('conversaciones').insert({
  lead_id, emisor: 'SISTEMA',
  mensaje: `🔍 Análisis Ojo de Halcón:\n${data.content}`,
  platform: 'PANEL_INTERNO',
  metadata: { author: 'Ojo de Halcón', type: 'receipt_analysis' }
});

// 4. Notificar al agente
const { data: agent } = await supabase.from('profiles')
  .select('phone').eq('id', lead.assigned_to).single();
if (agent?.phone) {
  await supabase.functions.invoke('send-message-v3', {
    body: { phone: agent.phone, message: `🔍 Comprobante recibido de ${lead.nombre}:\n${data.content}` }
  });
}
```

### Deteccion de contexto de pago en evolution-webhook

```typescript
// Despues de parsear el mensaje, antes de invocar AI
if (msg.type === 'image') {
  const caption = msg.image?.caption || '';
  const paymentPhrases = ['pagué', 'pague', 'transferí', 'transferi', 'comprobante',
    'deposité', 'deposite', 'ya pagué', 'aqui va', 'aquí va', 'envio comprobante'];
  const hasPaymentContext = paymentPhrases.some(p =>
    caption.toLowerCase().includes(p) || text.toLowerCase().includes(p));

  if (hasPaymentContext || lead.buying_intent === 'ALTO') {
    const imageId = msg.image?.id;
    if (imageId) {
      supabase.functions.invoke('analyze-receipt', {
        body: { image_id: imageId, lead_id: lead.id,
                channel_id: actualChannelId, caption }
      }).catch(err => console.error('analyze-receipt fire error:', err));
    }
  }
}
```

### CAPI en analyze-leads

```typescript
// Despues de actualizar buying_intent (linea ~95)
const oldIntent = lead.buying_intent;
const newIntent = updates.buying_intent;
const intentOrder = { 'BAJO': 0, 'MEDIO': 1, 'ALTO': 2 };

if (intentOrder[newIntent] > intentOrder[oldIntent]) {
  // Intent subio — disparar CAPI Lead event
  const capiConfig = {
    pixel_id: configMap.meta_pixel_id,
    access_token: configMap.meta_access_token,
    test_event_code: configMap.meta_test_event_code || undefined
  };
  if (capiConfig.pixel_id && capiConfig.access_token) {
    supabase.functions.invoke('meta-capi-sender', {
      body: {
        config: capiConfig,
        eventData: {
          event_name: 'Lead',
          event_id: `samurai_lead_${lead.id}_${newIntent}`,
          lead_id: lead.id,
          user_data: { ph: lead.telefono, fn: lead.nombre, ct: updates.ciudad || lead.ciudad, country: 'mx' },
          custom_data: { source: 'samurai_auto', content_name: `intent_${oldIntent}_to_${newIntent}` }
        }
      }
    }).catch(() => {});
  }
}
```

## Components Touched

| Component | Change | Story |
|-----------|--------|-------|
| `supabase/functions/analyze-receipt/index.ts` | NEW | S6.1 |
| `supabase/functions/evolution-webhook/index.ts` | ADD payment context detection + fire analyze-receipt | S6.1 |
| `SETUP_WEBSITE_SCRAPE_CRON.sql` | NEW | S6.2 |
| `supabase/functions/analyze-leads/index.ts` | ADD CAPI trigger on intent change | S6.3 |
| `supabase/functions/get-samurai-context/index.ts` | ADD ocr_content to media context | S6.4 |
| `src/pages/AgentBrain.tsx` | ADD tab for prompt_analista_datos | S6.5 |
