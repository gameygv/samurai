---
epic: E2
type: retrospective
status: complete
date: 2026-03-30
---

# E2: Retrospective — WhatsApp Message Reliability

## Outcome

All 4 stories completed, deployed, and E2E validated in production.
The P0 bug (IA messages not appearing in CRM) is resolved.

## Done Criteria Verification

- [x] Mensajes IA se guardan exactamente 1 vez en conversaciones
- [x] wamid almacenado para mensajes entrantes y salientes
- [x] Status webhooks actualizan estado de entrega en conversaciones
- [x] Graph API actualizada a v21.0
- [x] E2E tests verifican cada escenario en producción

## Root Cause Discovery

The original P0 bug had TWO root causes, not one:
1. **Duplicate insert** — both process-samurai-response and evolution-webhook tried to save IA messages (known before epic)
2. **CHECK constraint** — `conversaciones_emisor_check` only allowed CLIENTE/SAMURAI/HUMANO, so ALL `emisor: 'IA'` inserts silently failed (discovered during E2E testing of S2.2)

Root cause #2 was the actual reason messages never appeared. The duplicate insert was a secondary issue.

## Bonus Fixes (discovered during E2E)

1. `conversaciones_emisor_check` — added IA, SISTEMA, BOT to allowed values
2. Default provider in send-message-v3 — changed from 'gowa' (deprecated) to 'meta'

## Metrics

| Metric | Value |
|--------|-------|
| Stories | 4 (S2.1, S2.2, S2.3, S2.4 bundled) |
| Files modified | 3 edge functions + 2 migrations |
| Net LOC (code) | ~+50 lines across 3 functions |
| Migrations | 2 (columns + constraint fix) |
| E2E tests in prod | 6 (S2.2: 2, S2.3: 3, + dedup) |
| Design decisions | 10 (5 epic + 2 S2.1 + 3 S2.2) |
| Bugs found during testing | 2 (emisor constraint, gowa default) |

## Patterns Learned

- **E2E testing in production is essential** for Edge Functions — no local test infra exists
- **Always check DB constraints** before assuming an insert works
- **"Who generates, persists"** — clean ownership of data writes
- **Send before insert** — only register what was actually delivered
- **Interactive design** — discussing each decision built shared understanding and caught issues early

## What's next

- Display delivery checkmarks in ChatViewer (delivery_status field is ready)
- Clean up test leads from E2E testing
- Monitor activity_logs for any remaining IA insert errors
- Consider removing GOWA provider support entirely (feature flagged already)
