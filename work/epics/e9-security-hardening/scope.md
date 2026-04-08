# E9: Security Hardening — Scope

## Objective

Cerrar los gaps de seguridad críticos: autenticación en Edge Functions, RLS real por roles, protección de secrets y CORS restrictivo.

## Value

Hoy cualquier persona en internet puede invocar `system-wipe` y borrar toda la base de datos. Cualquier agente de ventas puede leer las API keys de OpenAI y Meta. Después de E9:
- Solo admins pueden ejecutar operaciones destructivas
- Agentes solo ven y modifican sus propios datos
- Secrets inaccesibles desde el frontend
- CORS limita requests al dominio de producción

## In Scope (MUST)

- Auth middleware compartido (`_shared/auth.ts`) con `requireAuth()` y `requireRole()`
- Proteger 6 funciones admin con auth + rol admin
- RLS policies reales para: leads, conversaciones, contacts, profiles, media_assets, whatsapp_channels, app_config, credit_sales, credit_installments
- Secrets de app_config a Supabase Secrets (env vars)
- CORS con allowlist de dominios (no wildcard)
- Revocar `GRANT ALL` del rol `anon`

## In Scope (SHOULD)

- app_config filtrado por category (secrets invisibles para no-admins)
- Unificar corsHeaders inline de 8 funciones al shared module

## Out of Scope

- Supabase Vault → env vars son suficientes
- Permisos granulares → roles simples (admin, gerente, agent)
- Rotación de keys → futuro
- CI/CD security scanning → Epic 10
- Rate limiting → nice-to-have, no bloquea

## Stories

| ID | Name | Size | Dependencies |
|----|------|------|-------------|
| S9.1 | Auth middleware + proteger funciones admin | M | — |
| S9.2 | RLS policies reales por rol | L | — |
| S9.3 | Secrets a env vars + proteger app_config | M | S9.1 |
| S9.4 | CORS restrictivo + hardening final | S | S9.1 |

## Done Criteria

1. `system-wipe` retorna 401 sin JWT, 403 sin rol admin
2. `app_config` secrets invisibles para rol agent
3. Agent solo ve leads/contacts con `assigned_to = auth.uid()`
4. `evolution-webhook` sigue funcionando sin JWT
5. CORS rechaza requests de dominios no autorizados
6. Todas las funciones admin requieren rol admin/dev

---

## Implementation Plan

### Sequencing Strategy: Walking Skeleton → Risk-First

| # | Story | Strategy | Rationale | Enables |
|---|-------|----------|-----------|---------|
| 1 | **S9.1** Auth middleware + admin functions | Walking skeleton | Establece el patrón de auth que todo lo demás usa. Cierra el gap más peligroso (system-wipe sin auth). Prueba la arquitectura de `_shared/auth.ts`. | S9.3, S9.4, M1 |
| 2 | **S9.2** RLS policies reales | Risk-first | Es la story más grande (L) y la más riesgosa — un error en RLS rompe toda la app. Mejor atacar temprano con energía y margen para rollback. | M2 |
| 3 | **S9.3** Secrets a env vars | Dependency-driven | Depende de S9.1 (auth middleware). Elimina secrets de app_config, requiere configurar Supabase Secrets primero. | M3 |
| 4 | **S9.4** CORS + hardening final | Quick win | Story más pequeña (S). Cierra los últimos gaps y unifica CORS inline. | M4 |

S9.1 y S9.2 podrían ejecutarse en paralelo (no dependen entre sí), pero secuencial es más seguro: S9.1 valida el patrón de auth que S9.2 necesita para testear.

### Critical Path

```
S9.1 ──→ S9.3 ──→ S9.4
  │
  └──→ S9.2 (puede correr después de S9.1 o en paralelo)
```

**Critical path**: S9.1 → S9.3 → S9.4 (auth → secrets → CORS).
S9.2 (RLS) es independiente pero se ejecuta segundo por su alto riesgo.

### Milestones

#### M1: Walking Skeleton — después de S9.1
- `_shared/auth.ts` existe y funciona
- 6 funciones admin protegidas con JWT + rol
- `curl` sin auth a system-wipe → 401
- `curl` con JWT de agent a system-wipe → 403
- `curl` con JWT de admin a system-wipe → funciona
- **Demo**: intentar borrar DB sin auth y ser rechazado

#### M2: Data Isolation — después de S9.2
- RLS policies reemplazadas en todas las tablas target
- Agent solo ve sus leads (verificado con query directa)
- Admin ve todo
- Secrets en app_config invisibles para agent
- `evolution-webhook` y crons siguen funcionando (usan service_role)
- **Demo**: login como agent, verificar que solo ve sus datos
- **Rollback SQL listo** por si algo falla

#### E2E Integration Checkpoint (entre M2 y M3)
Antes de S9.3, verificar:
- Frontend funciona correctamente con las nuevas RLS policies
- Todas las páginas cargan para admin Y para agent
- Chat, Contacts, Campaigns, Payments no se rompen
- Crons no fallan (verificar logs de Supabase)
- Edge Functions admin funcionan con auth headers desde el frontend

#### M3: Secrets Secured — después de S9.3
- `openai_api_key` en env var, no en app_config
- 10+ funciones usan `Deno.env.get('OPENAI_API_KEY')`
- Frontend no transmite tokens en request body
- **Demo**: query app_config como agent, no aparecen secrets

#### M4: Epic Complete — después de S9.4
- CORS rechaza origin desconocido
- Todas las funciones usan `_shared/cors.ts` (0 definiciones inline)
- Todos los done criteria verificados
- Retrospectiva completada
- **Demo**: fetch desde consola de otro dominio → bloqueado

### Progress Tracking

| Story | Status | Branch | Notes |
|-------|--------|--------|-------|
| S9.1 Auth middleware + admin | pending | — | — |
| S9.2 RLS policies | pending | — | — |
| S9.3 Secrets a env vars | pending | — | blocked by S9.1 |
| S9.4 CORS + hardening | pending | — | blocked by S9.1 |

### Sequencing Risks

| Risk | Mitigation |
|------|------------|
| S9.2 RLS rompe la app en producción | Preparar migration de rollback. Testear con queries de admin y agent ANTES de deploy. Deploy en horario de baja actividad. |
| S9.3 env vars no configurados antes de deploy | Ejecutar `supabase secrets set` ANTES de desplegar funciones nuevas. Mantener fallback a app_config temporalmente. |
| Frontend no envía Authorization header a funciones admin | Verificar que `supabase.functions.invoke()` ya incluye el JWT del usuario. Si no, agregar header explícito. |
