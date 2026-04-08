# E8: Testing & Type Safety

## Hypothesis

Si establecemos infraestructura de testing (unit, integration, e2e) y eliminamos la ausencia de tipos en el código, reduciremos los bugs en producción en un 60-80% y podremos desplegar con confianza sin verificación manual.

## Success Metrics

- [ ] Framework de testing frontend configurado (Vitest)
- [ ] Framework de testing backend configurado (Deno test)
- [ ] Tests e2e para flujos críticos de negocio (Playwright)
- [ ] `@ts-nocheck` eliminado de todas las Edge Functions
- [ ] Tipos de Supabase generados y usados en frontend
- [ ] Cobertura mínima: funciones críticas al 80%

## Appetite

2-3 semanas de trabajo enfocado. 4 stories estimadas.

## Rabbit Holes (evitar)

- No buscar 100% coverage — enfocarse en flujos críticos
- No reescribir Edge Functions solo por tipos — agregar tipos incrementalmente
- No configurar Playwright para flujos de UI cosméticos — solo flujos de negocio
- No bloquear deploys por tests aún — primero tener tests, luego gates
