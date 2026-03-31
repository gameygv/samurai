---
epic: E4
name: multimedia-pipeline
status: complete
closed: 2026-03-30
---

# E4 Retrospective: Multimedia Pipeline

## Metrics

| Metric | Value |
|--------|-------|
| Stories | 3 (S4.2, S4.1, S4.3) |
| Commits | ~15 across all stories |
| Files created | 3 (transcribe-audio, migration, story artifacts) |
| Files modified | 3 (evolution-webhook, process-samurai-response, get-samurai-context) |
| Patterns added | PAT-D-008 (--no-verify-jwt), PAT-D-009 (Meta dev tokens) |

## Hypothesis Validation

**Original hypothesis:** El bot no puede procesar notas de voz ni enviar imagenes
porque falta el "ultimo tramo" que conecta infraestructura existente.

**Result:** CONFIRMED. La infraestructura (UI, send-message-v3, system prompts)
ya existia. Solo faltaba:
- Un parser de 15 lineas para media tags (S4.2)
- Una edge function de 154 lineas para transcripcion (S4.1)
- 24 lineas de hardening (S4.3)
- Un campo de fecha en media_assets (bonus)

## What Went Well

1. **Diseño interactivo (decisión por decisión)** — las 5 decisiones del epic se
   tomaron antes de escribir código, evitando retrabajo
2. **Quick-win first (S4.2)** — el media parser dio valor visible en la primera story
3. **Fire-and-forget pattern** — la transcripcion async evitó timeout del webhook
4. **Reutilizacion de infraestructura** — send-message-v3 ya soportaba mediaData,
   zero cambios necesarios
5. **Bonus: valid_until** — se descubrio y resolvio el problema de posters expirados
   durante E2E testing

## What To Improve

1. **Deploy con JWT verification** — el re-deploy de evolution-webhook activó JWT y
   causó 401s de Meta. Ahora tenemos PAT-D-008 para recordar usar --no-verify-jwt.
2. **Token de desarrollo de Meta** — expira cada 1-2h, causó fallos durante testing.
   Necesitan migrar a System User Token permanente (PAT-D-009).
3. **Cold start después de deploy** — el primer request después de deploy puede fallar.
   Esperar ~30s o hacer un request de warmup.

## Decisions Log

| # | Decision | Outcome |
|---|----------|---------|
| D1 | Edge function separada transcribe-audio | Correcto — webhook responde rápido |
| D2 | Dos llamadas Graph API para audio | Correcto — unica forma de Meta API |
| D3 | Fallback con respuesta generica | Correcto — bot pide repetir, no silencio |
| D4 | Inline parser en process-samurai-response | Correcto — simple, sin overhead |
| D5 | Caption con fallback >1024 | Correcto — experiencia natural en WhatsApp |
| D4-S4.1 | Skip sync AI para audio | Crucial — sin esto AI respondía al placeholder |

## Risks Realized

| Risk | Happened? | Impact | Resolution |
|------|-----------|--------|------------|
| Whisper timeout | No | — | Fire-and-forget previno el riesgo |
| Token Meta expirado | Si | Alto | Renovacion manual, PAT-D-009 para futuro |
| URLs invalidas | No | — | Validacion preventiva en S4.3 |

## Deliverables

- transcribe-audio edge function (audio → Whisper → AI)
- Media tag parser (AI response → WhatsApp image)
- valid_until filter para posters expirados
- Audio size check, URL validation, success logging
- 2 patterns persistidos (PAT-D-008, PAT-D-009)
