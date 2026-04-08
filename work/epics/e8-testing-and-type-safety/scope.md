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

---

## Implementation Plan

### Sequencing Strategy: Quick Win → Risk-First

| # | Story | Rationale | Enables |
|---|-------|-----------|---------|
| 1 | **S8.1** Vitest + frontend tests | Quick win: bajo riesgo, establece `npm test`, valida tooling | M1, S8.4 |
| 2 | **S8.2** Tipos Supabase + @ts-nocheck | Risk-first: es la story más grande (L), ataca la incertidumbre de tipos temprano | S8.3 |
| 3 | **S8.3** Deno test + backend tests | Dependency-driven: usa los tipos de S8.2, completa cobertura backend | M3 |
| 4 | **S8.4** Playwright e2e | Integración final: valida flujos completos con todo lo anterior en su lugar | M4 |

S8.1 y S8.2 pueden ejecutarse en paralelo si hay capacidad, pero secuencialmente es más seguro para un solo developer.

### Milestones

#### M1: Walking Skeleton — después de S8.1
- `npm test` ejecuta y pasa
- Al menos 5 tests de frontend para utils/lib
- Script `test` en package.json
- **Demo**: correr `npm test` y ver verde

#### M2: Type Foundation — después de S8.2
- `src/integrations/supabase/types.ts` generado
- `supabase/functions/_shared/types.ts` creado
- 5 Edge Functions sin `@ts-nocheck`, compilando con `deno check`
- **Demo**: `deno check supabase/functions/get-samurai-context/index.ts` sin errores

#### M3: Full Test Coverage — después de S8.3
- `deno test` corre tests para 5 funciones críticas
- Happy path + error handling cubiertos
- **Demo**: correr `deno test supabase/functions/` y ver verde

#### M4: Epic Complete — después de S8.4
- Playwright e2e pasan para login + dashboard + chat
- Todos los done criteria verificados
- Retrospectiva completada
- **Demo**: `npx playwright test` verde con screenshots

### E2E Integration Checkpoint (entre M3 y M4)

Antes de S8.4, verificar que:
- Build de producción pasa (`npm run build`)
- Tipos generados no rompen el build
- Edge Functions desplegadas con tipos pasan en producción
- App local arranca sin errores en localhost:8080

### Progress Tracking

| Story | Status | Branch | Notes |
|-------|--------|--------|-------|
| S8.1 Vitest + frontend tests | pending | — | — |
| S8.2 Tipos + @ts-nocheck | pending | — | — |
| S8.3 Deno test + backend | pending | — | — |
| S8.4 Playwright e2e | pending | — | — |

### Sequencing Risks

| Risk | Mitigation |
|------|------------|
| S8.2 se alarga por cantidad de errores de tipos al quitar @ts-nocheck | Limitar a 5 funciones, no las 30. Las demás son deuda futura. |
| S8.4 e2e requiere datos seed que no existen | Crear fixture mínimo en el setup del test, no depender de prod. |
| Deno test imports incompatibles con serve() handler | Extraer lógica de negocio a funciones puras exportables, testear esas. |
