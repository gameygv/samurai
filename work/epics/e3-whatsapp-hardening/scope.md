---
epic: E3
name: whatsapp-hardening
---

# E3: Scope — WhatsApp Hardening & Cleanup

## Objective

Completar el hardening del sistema WhatsApp post-E2: renovar token,
limpiar datos de prueba, mostrar delivery status en UI, y eliminar
provider deprecated.

## In Scope

- S3.1: Renovar token Meta Cloud API (P0 — bot no envía sin esto)
- S3.2: Limpiar leads y conversaciones de prueba E2E
- S3.3: Mostrar delivery checkmarks en ChatViewer
- S3.4: Eliminar/deshabilitar provider GOWA

## Out of Scope

- Token auto-refresh (Meta no lo soporta para permanent tokens)
- Rediseño del sistema de canales
- Checkmarks animados o en tiempo real
- Migración de datos históricos de GOWA

## Planned Stories

| ID   | Title                                          | Priority |
|------|------------------------------------------------|----------|
| S3.1 | Renovar token Meta Cloud API                   | P0       |
| S3.2 | Limpiar datos de prueba E2E                    | P3       |
| S3.3 | Delivery checkmarks en ChatViewer              | P2       |
| S3.4 | Eliminar/deshabilitar provider GOWA            | P3       |

## Done Criteria

- Token Meta válido y mensajes IA enviándose (verificar en activity_logs)
- Cero leads con nombre "E2E Test" en producción
- ChatViewer muestra estado de entrega por mensaje
- GOWA deshabilitado o eliminado del código
