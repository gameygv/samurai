# E8: Testing & Type Safety — Scope

## Objective

Establecer infraestructura de testing completa y type safety para SAMURAI, habilitando despliegues confiables y previniendo regresiones de los 34 fixes aplicados en la auditoría del 2026-04-07.

## Value

Hoy SAMURAI tiene 0 tests y 0 type safety en el backend. Cualquier cambio puede romper algo sin aviso. Después de E8:
- Cada fix o feature puede verificarse automáticamente
- Los tipos del schema real previenen bugs de nombres de columna/tabla
- Los e2e validan que los flujos de negocio funcionan end-to-end

## In Scope (MUST)

- Vitest configurado con tests para utils, lib y hooks
- Deno test configurado con tests para 5 Edge Functions críticas
- Tipos de Supabase generados desde el schema remoto
- `@ts-nocheck` eliminado de al menos 5 funciones críticas
- Script `npm test` funcional

## In Scope (SHOULD)

- Playwright configurado con tests e2e para login + dashboard + chat
- Cobertura de funciones críticas al 80%

## Out of Scope

- Reescritura completa de Edge Functions → incremental
- 100% code coverage → innecesario
- CI/CD pipeline → Epic 10
- Security hardening → Epic 9
- `strict: true` en tsconfig → después de E8
- Eliminar todos los `any` del frontend → incremental

## Stories

| ID | Name | Size | Dependencies |
|----|------|------|-------------|
| S8.1 | Vitest setup + tests frontend | M | — |
| S8.2 | Tipos Supabase + eliminar @ts-nocheck | L | — |
| S8.3 | Deno test + tests backend | M | S8.2 (beneficia) |
| S8.4 | Playwright e2e | M | S8.1 |

## Done Criteria

1. `npm test` ejecuta y pasa (exit code 0)
2. `deno test supabase/functions/` ejecuta y pasa
3. `npx playwright test` ejecuta y pasa
4. `src/integrations/supabase/types.ts` existe y se importa
5. 5+ Edge Functions sin `@ts-nocheck`, verificadas con `deno check`
6. Script `test` en `package.json`
