# E10: CI/CD Pipeline

## Hypothesis

Si automatizamos la ejecución de tests y validaciones en cada push/PR, eliminaremos la posibilidad de que código roto llegue a main sin detección, y reduciremos la dependencia de verificaciones manuales.

## Success Metrics

- [ ] GitHub Actions workflow corre en cada push a main y en cada PR
- [ ] TypeScript check, Vitest y Deno test se ejecutan automáticamente
- [ ] Build de producción se verifica en CI
- [ ] Badge de status visible en el repositorio
- [ ] Tiempo de CI < 3 minutos

## Appetite

1 semana. 2 stories — esta epic es pequeña y bien definida.

## Rabbit Holes (evitar)

- No configurar Playwright en CI (requiere credenciales de Supabase real + browser, complejo)
- No configurar deploy automático de Edge Functions (requiere secrets de Supabase, riesgo)
- No bloquear merges por CI fallido (configurar como informativo primero, bloquear después)
- No over-engineer el workflow (un solo archivo .yml, no múltiples)
