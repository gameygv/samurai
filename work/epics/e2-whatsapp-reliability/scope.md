---
epic: E2
name: whatsapp-reliability
---

# E2: Scope — WhatsApp Message Reliability

## Objective

Garantizar que todos los mensajes del bot se registren en el CRM de forma confiable,
sin duplicados, siguiendo las mejores prácticas de Meta Cloud API.

## In Scope

- S2.1: Eliminar doble inserción de mensajes IA (consolidar en process-samurai-response)
- S2.2: Agregar columna message_id (wamid) a conversaciones + deduplicación
- S2.3: Procesar status webhooks de Meta (sent/delivered/read)
- S2.4: Actualizar versión de Graph API (v20.0 → v21.0+)

## Out of Scope

- Refactorizar arquitectura de Edge Functions
- Implementar message queuing
- Cambiar de proveedor de IA (OpenAI → otro)
- Retry logic avanzado
- Procesamiento asíncrono del webhook (requiere infraestructura adicional)

## Planned Stories

| ID   | Title                                          | Priority |
|------|------------------------------------------------|----------|
| S2.1 | Consolidar inserción de mensajes IA            | P0       |
| S2.2 | Deduplicación por wamid en conversaciones      | P1       |
| S2.3 | Procesar status webhooks de Meta               | P1       |
| S2.4 | Actualizar Graph API a versión estable reciente | P2       |

## Done Criteria

- Mensajes IA se guardan exactamente 1 vez en conversaciones
- wamid almacenado para mensajes entrantes y salientes
- Status webhooks actualizan estado de entrega
- Tests verifican cada escenario
