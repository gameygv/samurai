# E8: Testing & Type Safety — Design

## Gemba (estado actual)

### Frontend
- **0 tests**. Ni framework configurado.
- `tsconfig`: `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`
- 346 errores eslint (casi todos `no-explicit-any`)
- Sin tipos de Supabase generados — solo 1 archivo: `src/integrations/supabase/client.ts`
- TanStack Query instalado pero sin usar (0 useQuery/useMutation)
- Vite 6 + React 19 + SWC

### Backend (Edge Functions)
- **0 tests**. 30 funciones sin ninguna cobertura.
- `@ts-nocheck` en las 30 funciones — TypeScript completamente deshabilitado
- Deno runtime (std@0.190.0, supabase-js@2.45.0 via esm.sh)
- Sin shared types — cada función define sus propios `any`

### Tooling
- Supabase CLI 2.87.2 disponible (soporta `gen types`)
- No hay `vitest`, `playwright`, ni `@testing-library` en dependencies
- No hay scripts de test en package.json

## Decisiones arquitectónicas

### ADR-1: Vitest para frontend testing
- **Decisión**: Vitest (no Jest)
- **Razón**: Integración nativa con Vite, misma configuración de resolve/alias, velocidad superior con SWC, API compatible con Jest
- **Config**: Extender `vite.config.ts` con `test` block

### ADR-2: Deno test nativo para Edge Functions
- **Decisión**: `deno test` (no importar un framework externo)
- **Razón**: Nativo en Deno, sin configuración extra, soporta mocking con `std/testing`, mismos imports que las funciones
- **Estructura**: `supabase/functions/<name>/<name>.test.ts` junto a cada `index.ts`

### ADR-3: Playwright para e2e
- **Decisión**: Playwright (no Cypress)
- **Razón**: Multi-browser, auto-waiting, mejor API async, soporte nativo para auth state, más rápido en CI
- **Scope**: Solo flujos de negocio críticos (login, chat, campaña)

### ADR-4: Tipos Supabase generados como source of truth
- **Decisión**: `supabase gen types typescript` → `src/integrations/supabase/types.ts`
- **Razón**: Tipos directos del schema real, elimina drift entre código y DB
- **Impacto**: `client.ts` se re-exporta tipado, Edge Functions importan tipos compartidos

## Stories (detalle)

### S8.1 — Vitest setup + tests frontend (Size: M)
**Qué**: Instalar Vitest + testing-library. Escribir tests para utils, lib y hooks existentes.
**Entregable**: `npm test` corre y pasa. Cobertura de: `tag-parser.ts`, `chat-normalizer.ts`, `logger.ts`, `messagingService.ts`, `useRealtimeMessages.ts`.
**Dependencias**: Ninguna.

### S8.2 — Tipos Supabase + eliminar @ts-nocheck (Size: L)
**Qué**: Generar tipos con `supabase gen types`. Crear `_shared/types.ts` para Edge Functions. Eliminar `@ts-nocheck` de las 5 funciones críticas y corregir errores de tipos.
**Entregable**: Tipos generados. 5+ funciones sin `@ts-nocheck` compilando limpio.
**Dependencias**: Ninguna.
**Funciones target**: `get-samurai-context`, `process-samurai-response`, `evolution-webhook`, `send-message-v3`, `analyze-leads`.

### S8.3 — Deno test + tests backend (Size: M)
**Qué**: Crear tests para las 5 Edge Functions críticas. Mockear Supabase client y fetch (OpenAI).
**Entregable**: `deno test` corre y pasa. Tests cubren: happy path, error handling, edge cases de cada función.
**Dependencias**: Se beneficia de S8.2 (tipos), pero puede arrancar sin ellos.

### S8.4 — Playwright e2e (Size: M)
**Qué**: Instalar Playwright. Tests e2e para: login, dashboard con stats correctos, abrir chat desde contactos, envío de mensaje.
**Entregable**: `npx playwright test` corre contra la app local (localhost:8080).
**Dependencias**: S8.1 completada (para que `npm test` no interfiera).

## Grafo de dependencias

```
S8.1 (Vitest)  ──────────────────────────┐
                                          ├──→ S8.4 (Playwright)
S8.2 (Tipos) ──→ S8.3 (Deno test) ──────┘
```

S8.1 y S8.2 pueden ejecutarse en paralelo. S8.3 idealmente después de S8.2. S8.4 al final.

## Done Criteria (medibles)

1. `npm test` ejecuta y pasa (exit code 0)
2. `deno test supabase/functions/` ejecuta y pasa
3. `npx playwright test` ejecuta contra localhost:8080 y pasa
4. `src/integrations/supabase/types.ts` existe y se usa en `client.ts`
5. Al menos 5 Edge Functions sin `@ts-nocheck` y compilando con `deno check`
6. Script `test` agregado a `package.json`

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Quitar `@ts-nocheck` rompe funciones por tipos incompatibles | Alta | Media | Hacerlo función por función, verificar con deploy individual |
| Tests e2e frágiles por data real de Supabase | Media | Alta | Usar fixtures/seeds, no depender de datos de producción |
| Deno test no puede importar Edge Functions directamente | Baja | Alta | Refactorizar lógica a funciones exportables, testear la lógica no el handler |

## Parking Lot (deferred)

- Eliminar `any` del frontend completo → incremental en stories futuras
- Activar `strict: true` en tsconfig → después de E8, cuando tipos estén estabilizados
- CI/CD pipeline con test gates → Epic 10
- Tests de performance/load → fuera de scope
