---
epic: E2
type: architecture-review
status: approved
date: 2026-03-30
---

# E2: Architecture Review — WhatsApp Message Reliability

## Contact Points with `conversaciones` Table

| Location | Emisor | Platform | Has message_id |
|----------|--------|----------|----------------|
| evolution-webhook:131 | CLIENTE | WHATSAPP | No → S2.2 adds |
| evolution-webhook:152-154 | IA | WHATSAPP | **Duplicate — S2.1 removes** |
| process-samurai-response:131-140 | IA | WHATSAPP | No → S2.2 adds |
| ChatViewer.tsx:219 | HUMANO | PANEL | N/A (no wamid) |
| ChatViewer.tsx:173,181 | HUMANO | PANEL_INTERNO | N/A |
| Inbox.tsx:160,167,174,202 | HUMANO | PANEL/PANEL_INTERNO | N/A |
| MassMessageDialog.tsx:225 | HUMANO | CAMPAÑA | N/A |
| process-campaign-queue:57 | SISTEMA | CAMPAÑA_AUTO | N/A |
| MemoryPanel.tsx:114 | HUMANO | PANEL_INTERNO | N/A |

## Decision Validation

- D1 (INSERT in process-samurai-response): VIABLE — remove 4 lines from webhook
- D2 (supabase client): VIABLE — SERVICE_ROLE_KEY already in scope
- D3 (UNIQUE partial index): VIABLE — nullable column, zero impact on 11 insert points
- D4 (delivery_status field): VIABLE — depends on D3 for wamid lookup
- D5 (v21.0): VIABLE — trivial string change

## Dependencies

S2.1 (independent) → S2.2 (requires send-message-v3 refactor) → S2.3 (requires S2.2)
S2.4 (independent, bundle with S2.2)

## Risks

- R1: send-message-v3 doesn't return wamid — must parse Meta response (medium)
- R2: SQL migration on production — ADD COLUMN NULL is non-blocking (low)
- R3: campaign functions don't track wamid — acceptable, nullable column (low)
- R4: GOWA uses different ID format — only apply dedup to meta provider (low)

## Verdict

All 5 decisions viable and compatible. No blocking risks. AR approved.
