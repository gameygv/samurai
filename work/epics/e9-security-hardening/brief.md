# E9: Security Hardening

## Hypothesis

Si implementamos autenticación JWT en Edge Functions, RLS real por roles, gestión segura de secrets y CORS restrictivo, eliminamos el riesgo de que actores externos o usuarios no autorizados accedan, modifiquen o borren datos del sistema.

## Success Metrics

- [ ] Todas las Edge Functions admin validan JWT y rol antes de ejecutar
- [ ] RLS policies basadas en `auth.uid()` y roles reales (no `USING (true)`)
- [ ] API keys (OpenAI, Meta, Evolution) inaccesibles para usuarios no-admin
- [ ] CORS restringido al dominio de producción
- [ ] `system-wipe` y `admin-create-user` requieren rol admin verificado
- [ ] Tabla `whatsapp_channels` protegida con RLS

## Appetite

2-3 semanas. 4-5 stories.

## Rabbit Holes (evitar)

- No implementar un sistema de permisos granular completo — roles simples (admin, gerente, agent) son suficientes
- No migrar a Supabase Vault en esta epic si env vars resuelven el problema — Vault es nice-to-have
- No reescribir Edge Functions completas — agregar auth como wrapper/middleware al inicio
- No romper la funcionalidad existente — los webhooks (evolution-webhook) necesitan seguir siendo invocables sin JWT (son llamados por servicios externos)
