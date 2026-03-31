---
epic: E5
name: multichannel-hardening
status: complete
closed: 2026-03-31
---

# E5 Retrospective: Multi-Channel Hardening

## Metrics

| Metric | Value |
|--------|-------|
| Stories | 5 (S5.4, S5.3, S5.1, S5.2, S5.5) |
| Files created | 2 (process-lead-reminders, cron SQL) |
| Files modified | 3 (send-message-v3, transcribe-audio, analyze-leads) |
| Epics closed | 2 (E5 + E3) |
| Decisions | 5 (D1-D5, all interactive) |

## Hypothesis Validation

**Original hypothesis:** El sistema tiene gaps criticos para operar con 3 canales
simultaneos y agentes independientes.

**Result:** CONFIRMED. Los gaps principales eran:
- Recordatorios creados pero nunca enviados (108 lineas, cron)
- Auto-routing por ciudad inexistente (66 lineas en analyze-leads)
- Transcripcion crasheaba en canales Gowa (6 lineas, provider check)
- Telefono no normalizado para Gowa (1 linea)
- Canal fallback aleatorio (1 linea, ORDER BY)

## What Went Well

1. **Quick wins first** — S5.4 y S5.3 dieron momentum inmediato (5 min cada uno)
2. **Patron reutilizado** — process-lead-reminders modelado sobre process-credit-reminders
3. **Matching en dos pasos** — exacto gratis + IA como fallback inteligente
4. **Accent normalization** — previene mismatches Mazatlan vs Mazatlán
5. **E3 cerrada** — deuda de tracking eliminada

## What To Improve

1. **Agentes sin configurar** — territories y phone vacios, features dormidas
2. **Prompts de IA** — no pide proactivamente nombre/ciudad/email
3. **Cron cada hora** — puede tener hasta 59 min de delay
4. **Sin E2E testing** — auto-routing no probado con datos reales (agentes sin territories)

## Decisions Log

| # | Decision | Outcome |
|---|----------|---------|
| D1 | Bot siempre responde (horario es del agente) | Correcto — simplificó S5.1, eliminó story innecesaria |
| D2 | Recordatorios son para el agente | Correcto — canal de notificaciones como destino |
| D3 | Routing cuando se detecta ciudad | Correcto — analyze-leads es el punto natural |
| D4 | Match exacto + AI fallback | Correcto — eficiente para 80% de casos |
| D5 | Reutilizar default_notification_channel | Correcto — zero cambios en BD |

## Risks Realized

| Risk | Happened? | Impact |
|------|-----------|--------|
| Lead no menciona ciudad | Probable | Pendiente: mejorar prompts |
| IA matchea agente incorrecto | No probado | Bajo (activity_logs para verificar) |
| Cron delay | Aceptado | Bajo para recordatorios de agente |
| Agente sin telefono | Probable | Manejado con skip + log |

## Deliverables

- process-lead-reminders edge function + cron hourly
- Auto-routing por ciudad en analyze-leads (exacto + IA)
- Provider check en transcribe-audio (no crashea Gowa)
- Phone normalization + ordered fallback en send-message-v3
- E3 cerrada con retrospectiva
