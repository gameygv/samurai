# E10: CI/CD Pipeline — Scope

## Objective

Automatizar la verificación de calidad del código en cada push y PR mediante GitHub Actions, para que ningún cambio roto llegue a main sin detección.

## Value

Hoy los 150 tests solo corren si alguien los ejecuta manualmente. Después de E10, cada push automáticamente verifica types, tests y build. Un badge en el README muestra si main está sano.

## In Scope (MUST)

- GitHub Actions workflow para push a main y PRs
- Steps: install deps, tsc --noEmit, vitest run, deno test, npm run build
- Deno instalado en CI runner
- Status badge en README

## In Scope (SHOULD)

- Cache de node_modules y deno cache para acelerar CI
- Notificación en caso de fallo

## Out of Scope

- Playwright e2e en CI (requiere credenciales reales)
- Deploy automático de Edge Functions (requiere supabase secrets)
- Branch protection rules (configurar después de validar que CI funciona)
- Deploy a Vercel desde CI (Vercel ya hace auto-deploy)

## Stories

| ID | Name | Size | Dependencies |
|----|------|------|-------------|
| S10.1 | GitHub Actions workflow + badge | S | — |
| S10.2 | Cache optimization + branch protection | XS | S10.1 |

## Done Criteria

1. Push a main dispara GitHub Actions workflow
2. Workflow ejecuta: tsc, vitest, deno test, build
3. Workflow pasa (green check en GitHub)
4. Badge visible en README.md
5. CI completa en < 3 minutos
