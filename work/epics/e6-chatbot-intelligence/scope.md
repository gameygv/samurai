---
epic: E6
name: chatbot-intelligence
status: in-progress
---

# E6 Scope: Chatbot Intelligence

## Objective

Conectar los flujos automáticos del chatbot que tienen infraestructura pero les falta
el "último tramo": análisis automático de comprobantes, scrape diario del sitio web,
disparo automático de CAPI, y inyección de OCR en el contexto AI.

## In Scope

- S6.1: Ojo de Halcón automático — analizar comprobantes de pago enviados por WhatsApp
- S6.2: Cron diario para Verdad Maestra — scrape automático del sitio web a las 3am
- S6.3: CAPI automático — disparar eventos Lead/Purchase cuando el bot los detecta
- S6.4: OCR content en contexto AI — inyectar texto extraído de imágenes al system prompt
- S6.5: Editor directo para prompt_analista_datos en Cerebro Core

## Out of Scope

- Aprobación automática de pagos (solo análisis + notificación)
- OCR de cada imagen recibida (solo cuando el AI detecta intención de pago)
- Rediseño del sistema de prompts
- CAPI para eventos distintos a Lead y Purchase
- Cambios a #CIA (ya funciona correctamente)

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| D1 | Cuando analizar imagen | Solo cuando buying_intent = ALTO o frases de pago en caption |
| D2 | Cuando disparar CAPI | Lead event en analyze-leads (intent sube) + Purchase cuando COMPRADO |
| D3 | Que hacer con resultado comprobante | Nota interna en chat (amarilla) + WhatsApp al agente |

## Stories

### S6.1: Ojo de Halcón Automático (M)
**Donde:** Nueva function `analyze-receipt` + cambios en `evolution-webhook`
**Que:** Cuando el cliente envía una imagen y el contexto indica pago
(buying_intent ALTO o frases como "ya pagué"), fire-and-forget a analyze-receipt.
La function descarga la imagen de Meta Graph API, invoca scrape-website VISION,
inserta nota interna (amarilla) en conversaciones, notifica al agente por WhatsApp.
**Contexto:** scrape-website VISION ya funciona. Patron similar a transcribe-audio.

### S6.2: Cron Verdad Maestra (S)
**Donde:** Nuevo SQL cron + verificación de scrape-main-website
**Que:** Cron diario a las 3am UTC que ejecuta scrape-main-website para actualizar
el contenido de todos los links registrados en main_website_content.
**Contexto:** La función existe y funciona manualmente. Solo falta el cron.

### S6.3: CAPI Automático (M)
**Donde:** `analyze-leads/index.ts` o `process-samurai-response/index.ts`
**Que:** Cuando analyze-leads detecta un cambio de buying_intent (BAJO→MEDIO,
MEDIO→ALTO) o cuando el bot detecta intención de compra, disparar meta-capi-sender
con evento Lead o Purchase. Usar datos del lead (email, phone, city, name).
**Contexto:** meta-capi-sender existe y funciona. Solo falta el trigger automático.

### S6.4: OCR Content en Contexto AI (S)
**Donde:** `get-samurai-context/index.ts`
**Que:** Incluir ocr_content de media_assets relevantes en el system prompt.
Cuando un poster tiene texto extraído (OCR), el AI puede usarlo para dar
información más precisa sobre talleres.
**Contexto:** El campo ocr_content existe en media_assets pero no se carga
en el contexto del AI.

### S6.5: Editor Analista CAPI en Cerebro Core (XS)
**Donde:** `src/pages/AgentBrain.tsx`
**Que:** Agregar tab o sección para editar prompt_analista_datos directamente,
sin depender del Laboratorio IA.
**Contexto:** El prompt existe en app_config pero no tiene editor directo.

## Done Criteria

- [ ] Imagen de comprobante por WhatsApp → análisis automático + aviso al agente
- [ ] Verdad Maestra se actualiza sola a las 3am
- [ ] Evento CAPI Lead disparado cuando buying_intent sube a MEDIO o ALTO
- [ ] OCR de posters accesible para el AI en sus respuestas
- [ ] prompt_analista_datos editable desde Cerebro Core
- [ ] Zero regression en mensajes de texto normales

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Falsos positivos en detección de comprobante | Media | Media | Solo analizar cuando buying_intent es ALTO o frase de pago |
| Scrape falla silenciosamente en cron | Baja | Media | Log en activity_logs |
| CAPI duplicado por múltiples cambios de intent | Media | Baja | Event ID único por lead + intent change |
