---
epic: E2
name: whatsapp-reliability
status: complete
created: 2026-03-30
---

# E2: WhatsApp Message Reliability

## Hypothesis

Los mensajes enviados por el bot de IA no se registran consistentemente en el CRM
porque hay doble inserción, falta deduplicación, y el webhook no sigue las mejores
prácticas de Meta Cloud API. Corrigiendo estos problemas, el 100% de los mensajes
enviados y recibidos quedarán registrados y rastreables.

## Success Metrics

- 100% de mensajes IA aparecen en el CRM (sin duplicados, sin pérdidas)
- wamid rastreado para todos los mensajes (entrantes y salientes)
- Status webhooks (sent/delivered/read) procesados y almacenados
- Cero mensajes duplicados por reenvío de webhook de Meta

## Appetite

3-5 stories, ~2 sesiones de trabajo.

## Rabbit Holes

- No implementar colas de mensajes (overkill para el volumen actual)
- No refactorizar la arquitectura completa de Edge Functions
- No implementar retry logic complejo — Meta ya reenvía webhooks
