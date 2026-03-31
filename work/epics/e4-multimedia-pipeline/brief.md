---
epic: E4
name: multimedia-pipeline
status: complete
created: 2026-03-30
---

# E4: Multimedia Pipeline (Audio Transcription + Image Sending)

## Hypothesis

El bot no puede procesar notas de voz (las reemplaza con "[Nota de Voz]" sin transcribir)
ni enviar imagenes a WhatsApp (los tags <<MEDIA:url>> se envian como texto literal).
La infraestructura ya existe en ambos extremos (UI, send-message-v3, system prompt) pero
falta el "ultimo tramo" que conecta las piezas. Implementando transcripcion con Whisper
y un parser de media tags, el bot podra entender audios y enviar posters/imagenes.

## Success Metrics

- Notas de voz transcritas automaticamente via OpenAI Whisper
- Transcripcion almacenada en formato `[TRANSCRIPCION DE NOTA DE VOZ]: "texto"`
- IA responde al contenido real del audio, no al placeholder
- Tags `<<MEDIA:url>>` extraidos de la respuesta IA y enviados como imagenes reales
- Cliente recibe imagen + texto limpio (sin tags visibles)
- Zero regression en mensajes de texto normales

## Appetite

3-4 stories, ~2 sesiones de trabajo.

## Rabbit Holes

- No implementar transcripcion de video (solo audio/notas de voz)
- No soportar multiples imagenes en una sola respuesta (una imagen por respuesta es suficiente por ahora)
- No construir un servicio de media separado (integrar directamente en los edge functions existentes)
- No hacer OCR de imagenes recibidas (fuera de scope)
