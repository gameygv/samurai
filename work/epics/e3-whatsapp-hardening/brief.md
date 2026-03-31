---
epic: E3
name: whatsapp-hardening
status: closed
created: 2026-03-30
predecessor: E2
---

# E3: WhatsApp Hardening & Cleanup

## Hypothesis

E2 resolvió la confiabilidad del registro de mensajes, pero dejó deuda técnica
visible: token Meta expirado (bot no puede enviar), leads de prueba en producción,
delivery status sin UI, y provider GOWA deprecated pero activo. Resolviendo estos
items, el sistema queda limpio y el operador tiene visibilidad completa.

## Success Metrics

- Token Meta renovado y mensajes IA enviándose correctamente
- Cero leads de prueba en producción
- Delivery status visible en el chat del CRM (checkmarks)
- GOWA eliminado o completamente deshabilitado

## Appetite

4 stories, ~1-2 sesiones de trabajo.

## Rabbit Holes

- No rediseñar el sistema de canales completo
- No implementar token auto-refresh (Meta no lo soporta para permanent tokens)
- No hacer los checkmarks animados o en tiempo real (polling de 10s ya existe)

## Context from E2

### Key Learnings
- El CHECK constraint en emisor fue el root cause real del P0 — siempre verificar constraints
- E2E testing en prod es esencial para Edge Functions (no hay test local)
- El patrón "send first, insert after" previene registros fantasma
- Default provider estaba hardcoded como 'gowa' — ya corregido a 'meta' en E2

### Architecture State Post-E2
- `conversaciones` tiene columnas `message_id` (wamid) y `delivery_status`
- Partial unique index en `message_id WHERE NOT NULL`
- `evolution-webhook` procesa status webhooks (sent/delivered/read/failed)
- `send-message-v3` parsea wamid de Meta response, usa v21.0, default provider 'meta'
- `process-samurai-response` envía primero → captura wamid → inserta con message_id
- Emisor constraint permite: CLIENTE, IA, HUMANO, SAMURAI, BOT, SISTEMA

### Active Issues Found During E2E
- Meta token expired 2026-03-30 17:00 PDT — send-message-v3 returns OAuthException 190
- 3 test leads in production: E2E Test Lead, E2E Test V2, E2E Test V3
- delivery_status field populated but not visible in UI
- GOWA channel "Gowa 01" still active (id: a488f580-20bc-460e-98e7-56d9741d3c4e)
- Fallback chain in send-message-v3 can still land on GOWA if no channel configured

### File Reference
- `supabase/functions/evolution-webhook/index.ts` — webhook + status processing
- `supabase/functions/send-message-v3/index.ts` — message gateway, v21.0, wamid parsing
- `supabase/functions/process-samurai-response/index.ts` — AI brain, send-first pattern
- `src/hooks/useRealtimeMessages.ts` — realtime messages hook, does `select('*')` so delivery_status already arrives
- `src/components/ChatViewer.tsx` — chat UI, message rendering
- `src/components/chat/MessageInput.tsx` — message input
- `src/components/settings/ChannelsTab.tsx` — channel management UI
