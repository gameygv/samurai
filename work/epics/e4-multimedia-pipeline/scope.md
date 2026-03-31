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

- S4.1: Transcripcion de audio (Whisper) — descargar audio de Meta, transcribir, formatear
- S4.2: Parser de media tags — extraer <<MEDIA:url>> de respuesta IA, enviar como imagen
- S4.3: Integracion E2E y edge cases — multiples medias, fallbacks, logging

## Out of Scope

- Transcripcion de video
- OCR de imagenes recibidas del cliente
- Soporte para documentos/stickers entrantes
- Servicio de media independiente
- Cache o almacenamiento local de archivos de audio

## Stories

### S4.1: Audio Transcription via Whisper
**Donde:** `evolution-webhook/index.ts`
**Que:** Cuando `msg.type === 'audio'`, descargar el archivo via Meta Graph API,
enviarlo a OpenAI Whisper (`/v1/audio/transcriptions`), formatear como
`[TRANSCRIPCION DE NOTA DE VOZ]: "texto"` y pasar al pipeline normal.
**Riesgo:** Latencia de Whisper puede hacer timeout del webhook. Solucion: fire-and-forget
o respuesta asincrona.

### S4.2: Media Tag Parser in AI Response
**Donde:** `process-samurai-response/index.ts` (lineas 125-134)
**Que:** Despues de recibir `aiText` de OpenAI, extraer todos los `<<MEDIA:url>>`,
limpiar el texto, enviar imagen via `send-message-v3` con `mediaData`, luego enviar
texto limpio. Orden: imagen primero, texto despues.
**Riesgo:** Bajo — send-message-v3 ya soporta mediaData, solo falta el parser.

### S4.3: Edge Cases & Observability
**Donde:** Ambos functions
**Que:** Manejar fallos de Whisper (fallback a "[Nota de Voz — no se pudo transcribir]"),
URLs de media invalidas, logging en activity_logs para ambos flujos.
**Riesgo:** Bajo.

## Done Criteria

- [ ] Nota de voz recibida -> transcrita -> IA responde al contenido real
- [ ] Respuesta IA con <<MEDIA:url>> -> cliente recibe imagen + texto limpio
- [ ] Fallos de transcripcion loggeados y con fallback graceful
- [ ] Tests E2E validados en produccion
- [ ] Zero regression en mensajes de texto normales
