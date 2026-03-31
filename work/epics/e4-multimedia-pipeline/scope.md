---
epic: E4
name: multimedia-pipeline
status: in-progress
---

# E4 Scope: Multimedia Pipeline

## Objective

Habilitar el procesamiento completo de multimedia en el bot: transcripcion de notas
de voz (entrada) y envio de imagenes (salida). Conectar la infraestructura existente
que ya soporta ambos flujos pero no esta cableada end-to-end.

## In Scope

- S4.1: Transcripcion de audio (Whisper) via edge function `transcribe-audio`
- S4.2: Parser de media tags inline en `process-samurai-response`
- S4.3: Edge cases, fallbacks, observability

## Out of Scope

- Transcripcion de video
- OCR de imagenes recibidas del cliente
- Soporte para documentos/stickers entrantes
- Servicio de media independiente
- Cache o almacenamiento local de archivos de audio
- Multiples imagenes por respuesta (una por ahora)

## Decisions

| # | Decision | Choice |
|---|----------|--------|
| D1 | Donde transcribir | Edge function separada `transcribe-audio` (fire-and-forget) |
| D2 | Como descargar audio | Dos llamadas Graph API v21.0 (get URL + download) |
| D3 | Fallback de Whisper | Respuesta generica — bot pide que repita + log |
| D4 | Parser de media tags | Inline en process-samurai-response, regex |
| D5 | Orden imagen/texto | Caption en imagen, fallback a separados si >1024 chars |

## Stories

### S4.1: Audio Transcription via Whisper (M)
**Donde:** Nueva function `transcribe-audio` + cambios en `evolution-webhook`
**Que:**
1. `evolution-webhook` detecta `msg.type === 'audio'`, extrae `msg.audio.id`
2. Inserta placeholder `[Nota de Voz]` en conversaciones (como hoy)
3. Fire-and-forget a `transcribe-audio` con `{ media_id, lead_id, message_id, channel_id }`
4. `transcribe-audio`: obtiene api_key del canal, GET Graph API para URL temporal,
   GET URL temporal para binario, POST a Whisper `/v1/audio/transcriptions`
5. UPDATE conversaciones SET mensaje = `[TRANSCRIPCION DE NOTA DE VOZ]: "texto"`
6. Invoca `process-samurai-response` con texto transcrito
**Fallback:** Si Whisper falla, UPDATE a `[Nota de Voz — no se pudo transcribir]`,
invocar process-samurai-response para que bot pida repetir, log en activity_logs.
**Deps:** Ninguna

### S4.2: Media Tag Parser in AI Response (S)
**Donde:** `process-samurai-response/index.ts` (despues de linea 125)
**Que:**
1. Regex `<<MEDIA:(https?:\/\/[^>]+)>>` sobre aiText
2. Si hay match: extraer URL, limpiar texto (quitar tag)
3. Si texto limpio <= 1024 chars: send-message-v3 con mediaData + caption
4. Si texto limpio > 1024 chars: send-message-v3 con mediaData (sin caption),
   luego send-message-v3 con texto limpio
5. Si no hay match: flujo actual sin cambios
**Deps:** Ninguna (independiente de S4.1)

### S4.3: Edge Cases & Observability (S)
**Donde:** Ambas functions
**Que:**
- Audio >25MB: log + fallback (Whisper limite)
- URL de media invalida en respuesta IA: log + enviar solo texto
- activity_logs para transcripciones exitosas y fallidas
- activity_logs para imagenes enviadas
**Deps:** S4.1, S4.2

## Done Criteria

- [ ] Nota de voz recibida -> transcrita -> IA responde al contenido real
- [ ] Respuesta IA con <<MEDIA:url>> -> cliente recibe imagen como media WA
- [ ] Caption en imagen cuando texto <= 1024 chars
- [ ] Fallos de transcripcion: bot pide repetir + log para operador
- [ ] URLs de media invalidas: solo texto enviado + log
- [ ] Zero regression en mensajes de texto normales

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Whisper timeout/latencia alta | Media | Media | Fire-and-forget, fallback con respuesta generica |
| Token Meta expirado (no puede descargar audio) | Alta | Alta | Reutilizar api_key del canal, misma renovacion que send-message |
| AI genera tags <<MEDIA:>> con URLs invalidas | Baja | Baja | Validar URL antes de enviar, fallback a solo texto |

## Implementation Plan

### Sequencing

| Order | Story | Size | Strategy | Rationale |
|-------|-------|------|----------|-----------|
| 1 | S4.2: Media Tag Parser | S | Quick win | Valor visible inmediato, bajo riesgo, independiente |
| 2 | S4.1: Audio Transcription | M | Risk-first (de los restantes) | Componente nuevo, latencia Whisper es la incognita principal |
| 3 | S4.3: Edge Cases | S | Dependency-driven | Requiere S4.1 y S4.2 completas para hardening |

**Parallelismo:** S4.1 y S4.2 podrian correr en paralelo (archivos diferentes, sin dependencia mutua),
pero como es un solo desarrollador, se ejecutan secuencialmente. S4.2 primero por quick-win.

**Critical path:** S4.1 → S4.3 (S4.1 es la story mas compleja y bloquea el hardening de audio).

### Milestones

#### M1: Imagenes Funcionando (after S4.2)
- [ ] Enviar mensaje que dispare <<MEDIA:url>> en respuesta IA
- [ ] Cliente recibe imagen real en WhatsApp (no texto literal)
- [ ] Caption visible en la imagen
- [ ] Mensajes sin media siguen funcionando igual
- **Demo:** Preguntar al bot algo que dispare un poster → verificar en WhatsApp

#### M2: Audio Funcionando (after S4.1)
- [ ] Enviar nota de voz al bot
- [ ] Transcripcion aparece en conversaciones como `[TRANSCRIPCION DE NOTA DE VOZ]: "..."`
- [ ] Bot responde al contenido real del audio
- [ ] Fallback funciona cuando Whisper falla
- **Demo:** Enviar audio preguntando por un producto → bot responde con info del producto

#### M3: Epic Complete (after S4.3)
- [ ] Logging completo en activity_logs para ambos flujos
- [ ] Edge cases manejados (audio grande, URL invalida)
- [ ] Zero regression en mensajes de texto normales
- [ ] Retrospectiva completada
- **Gate:** `/rai-epic-close`

### Progress Tracking

| Story | Status | Started | Completed | Notes |
|-------|--------|---------|-----------|-------|
| S4.2: Media Tag Parser | complete | 2026-03-30 | 2026-03-30 | E2E validated, +bonus valid_until filter |
| S4.1: Audio Transcription | pending | — | — | |
| S4.3: Edge Cases | pending | — | — | |
