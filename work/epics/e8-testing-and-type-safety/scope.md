# E8: Testing & Type Safety — Scope

## Objective

Establecer infraestructura de testing completa y type safety para SAMURAI, habilitando despliegues confiables y previniendo regresiones de los 34 fixes aplicados en la auditoría del 2026-04-07.

## In Scope

- Configurar Vitest para tests unitarios e integración del frontend
- Configurar Deno test para Edge Functions
- Configurar Playwright para tests e2e de flujos críticos
- Generar tipos TypeScript desde schema de Supabase
- Eliminar `@ts-nocheck` de las Edge Functions críticas
- Tests para las 5 funciones backend más críticas: evolution-webhook, process-samurai-response, get-samurai-context, send-message-v3, analyze-leads
- Tests e2e para: login, dashboard stats, abrir chat desde contactos, envío de mensaje

## Out of Scope

- Reescritura completa de Edge Functions
- 100% code coverage
- CI/CD pipeline (Epic 10)
- Security hardening (Epic 9)
- Refactor de `any` en todo el frontend (incremental, no big bang)

## Planned Stories

1. **S8.1** — Setup Vitest + tests para utils, hooks y lib
2. **S8.2** — Setup Deno test + tests para Edge Functions críticas
3. **S8.3** — Generar tipos Supabase + eliminar @ts-nocheck en funciones críticas
4. **S8.4** — Setup Playwright + tests e2e para flujos de negocio

## Done Criteria

- `npm test` corre tests de frontend sin errores
- `deno test` corre tests de backend sin errores
- `npx playwright test` corre e2e contra entorno de dev
- Tipos de Supabase generados y en uso
- Al menos 5 Edge Functions sin `@ts-nocheck`
