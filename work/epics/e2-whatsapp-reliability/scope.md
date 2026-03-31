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

## Design Decisions (ADR)

| # | Decisión | Elección | Razón |
|---|----------|----------|-------|
| D1 | ¿Dónde vive el INSERT de mensajes IA? | Solo en process-samurai-response | Responsabilidad única: quien genera, persiste |
| D2 | ¿Cómo hacer el insert? | Cliente supabase estándar (.insert().select()) | Idiomático, SERVICE_ROLE_KEY bypasea RLS, retorna row |
| D3 | ¿Cómo deduplicar? | Columna message_id + UNIQUE parcial (WHERE NOT NULL) | BD protege WhatsApp, Panel sin wamid pasa normal |
| D4 | ¿Status webhooks? | Campo delivery_status en conversaciones | Ligero, aprovecha wamid, sin tabla extra |
| D5 | ¿Versión Graph API? | v21.0 | Estable, v20.0 expira ~mayo 2026, formato idéntico |

## Implementation Plan

### Sequencing Strategy: Quick-win + Dependency-driven

| Order | Story | Rationale | Dependencies | Enables |
|-------|-------|-----------|--------------|---------|
| 1 | **S2.1** | Quick win P0 — fix inmediato, 0 deps, resuelve el bug activo | Ninguna | Confianza en que IA messages se guardan |
| 2 | **S2.2** | Risk-first — toca schema + refactor send-message-v3 (R1) | Ninguna (hard) | S2.3, S2.4 |
| 3 | **S2.4** | Bundle con S2.2 — cambio trivial en misma función | Soft: S2.2 (misma función) | Nada |
| 4 | **S2.3** | Depende de S2.2 — necesita message_id para UPDATE | Hard: S2.2 | Nada |

### Critical Path

```
S2.1 → deploy → verificar fix
S2.2 → S2.4 (bundle) → S2.3
```

S2.1 es independiente y se puede hacer primero. S2.4 se bundlea con S2.2 porque tocan la misma función (send-message-v3).

### Milestones

**M1: Bug Fix (S2.1)**
- Stories: S2.1
- Criterio: Mensajes IA se guardan exactamente 1 vez, sin duplicados
- Verificación: Enviar mensaje a WhatsApp, confirmar 1 solo registro en conversaciones

**M2: Core Reliability (S2.2 + S2.4)**
- Stories: S2.2, S2.4
- Criterio: wamid almacenado, dedup activa, API v21.0
- Verificación: Mismo wamid no crea duplicado, Meta API responde con v21.0

**M3: Epic Complete (S2.3)**
- Stories: S2.3
- Criterio: Status webhooks actualizan delivery_status en conversaciones
- Verificación E2E: Enviar mensaje → confirmar sent/delivered/read en BD

### Progress Tracking

| Story | Status | Branch | Notes |
|-------|--------|--------|-------|
| S2.1 | pending | — | — |
| S2.2 | pending | — | — |
| S2.4 | pending | — | — |
| S2.3 | pending | — | — |

### Sequencing Risks

1. S2.2 requiere migración SQL en producción — mitigado: ADD COLUMN NULL no bloquea
2. S2.2 requiere parsear response de Meta en send-message-v3 — requiere validar formato real
3. S2.3 depende de S2.2 — si S2.2 se retrasa, S2.3 no puede empezar

## Done Criteria

- Mensajes IA se guardan exactamente 1 vez en conversaciones
- wamid almacenado para mensajes entrantes y salientes
- Status webhooks actualizan estado de entrega en conversaciones
- Graph API actualizada a v21.0
- Tests verifican cada escenario
