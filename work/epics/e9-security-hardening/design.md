# E9: Security Hardening — Design

## Gemba (estado actual)

### Auth en Edge Functions
- **0 funciones verifican JWT o rol.** Todas aceptan cualquier request HTTP.
- Las funciones usan `SUPABASE_SERVICE_ROLE_KEY` para crear el cliente → bypasean RLS.
- No hay header `Authorization` verificado en ninguna función.
- `system-wipe` solo verifica que body contenga `"FACTORY_RESET"` — cualquiera puede enviarlo.

### Roles en el frontend
El `AuthContext.tsx` define estos roles (línea 94-106):
- `dev` — hardcoded para `gameygv@gmail.com`, isAdmin + isManager
- `admin` — isAdmin + isManager
- `gerente` — isManager (no isAdmin)
- `agent` / `sales_agent` / `sales` — isSalesAgent (base)

Estos roles viven en `profiles.role` pero **no hay CHECK constraint** en la DB (fue removido por `FIX_GERENTE_ROLE.sql`).

### RLS actual
Todas las policies son `USING (true)`:
- `leads`: SELECT/INSERT/UPDATE con `true`
- `conversaciones`: ALL con `true`
- `media_assets`: ALL con `true`
- `app_config`: SELECT/UPDATE/INSERT con `true` para `authenticated`

`FIX_PERMISSIONS.sql` otorga `GRANT ALL ON ALL TABLES` al rol `anon` — el nivel más permisivo posible.

### Secrets en app_config
`app_config` tiene columna `category` con valores: `PROMPT`, `WEBHOOK`, `SECRET`, `SYSTEM`. Los secrets están ahí pero **no hay policy que filtre por category**. Cualquier authenticated user lee todo.

**10 funciones leen `openai_api_key`** de app_config: process-samurai-response, analyze-leads, get-ai-suggestions, simulate-samurai, evaluate-agent, audit-chat-performance, tune-samurai-prompts, scrape-website, transcribe-audio, analyze-receipt.

`meta_access_token` es leído por analyze-leads.

### CORS
`_shared/cors.ts` exporta `Access-Control-Allow-Origin: *`. 8 funciones definen sus propios corsHeaders inline (también wildcard).

### Funciones que DEBEN permanecer sin JWT
Estas son invocadas por servicios externos o crons de Supabase:
- `evolution-webhook` — llamado por Meta/Evolution API
- `meta-wa-capi-verify` — llamado por Meta para verificar webhook
- `process-followups` — llamado por cron
- `process-lead-reminders` — llamado por cron
- `process-credit-reminders` — llamado por cron
- `process-campaign-queue` — llamado por cron
- `analyze-leads` — llamado por cron y por evolution-webhook
- `auto-sync-knowledge` — llamado por cron
- `scrape-main-website` — llamado por cron

## Decisiones arquitectónicas

### ADR-1: Auth middleware como función helper en `_shared/auth.ts`
- **Decisión**: Crear `requireAuth(req, supabaseClient, roles?)` que extraiga JWT del header Authorization, lo valide con `supabase.auth.getUser()`, busque el rol en `profiles`, y retorne `{ user, profile }` o lance error 401/403.
- **Razón**: Patrón simple, reutilizable, no requiere framework. Cada función decide si lo llama o no.
- **Alternativa descartada**: Supabase Edge Function JWT verification nativa (`verify_jwt = true` en config.toml) — requiere config.toml que no existe, y no permite verificar roles (solo que el JWT es válido).

### ADR-2: RLS por roles usando JWT claims
- **Decisión**: Las policies de RLS usarán `auth.uid()` para filtrar datos por usuario y `auth.jwt() ->> 'role'` o joins a `profiles.role` para decisiones de rol.
- **Razón**: Supabase ya inyecta `auth.uid()` en cada request autenticado. No necesitamos custom claims.
- **Modelo de acceso**:
  - `admin/dev`: acceso total (USING true)
  - `gerente`: acceso total (manager)
  - `agent`: solo datos donde `assigned_to = auth.uid()` (leads, contacts vía lead)
  - `app_config` con `category = 'SECRET'`: solo admin/dev

### ADR-3: Secrets migrados a Deno.env.get() en Edge Functions
- **Decisión**: `openai_api_key`, `meta_access_token`, `evolution_api_key` se configuran como Supabase Secrets (`supabase secrets set`) y se leen con `Deno.env.get()`.
- **Razón**: Las Edge Functions ya usan service_role_key vía env var. Es el patrón establecido. Evita queries extra a app_config en cada invocación.
- **Impacto**: 10+ funciones que leen de app_config cambiarán a env var.
- **app_config retiene**: prompts, webhooks, config pública (UI settings). Solo pierde los secrets.

### ADR-4: CORS con allowlist de dominios
- **Decisión**: Reemplazar `*` con allowlist verificando `Origin` header contra dominios permitidos. Para funciones de webhook (evolution-webhook, meta-wa-capi-verify): mantener `*` porque son llamadas server-to-server.
- **Razón**: CORS `*` permite que cualquier sitio web haga requests. La allowlist limita a producción + localhost para dev.

## Stories (detalle)

### S9.1 — Auth middleware + proteger funciones admin (Size: M)
**Qué**: Crear `_shared/auth.ts` con `requireAuth()` y `requireRole()`. Integrar en: system-wipe, admin-create-user, admin-reset-password, manage-auth-users, update-user-email, manage-prompt-versions (6 funciones).
**Entregable**: Las 6 funciones retornan 401 sin JWT y 403 sin rol admin.
**Dependencias**: Ninguna.

### S9.2 — RLS policies reales por rol (Size: L)
**Qué**: Crear migration que elimine policies `USING(true)` y las reemplace con policies basadas en roles. Tablas: leads, conversaciones, contacts, profiles, media_assets, whatsapp_channels, app_config, credit_sales, credit_installments.
**Entregable**: Un agente solo ve sus leads/contacts. Un admin ve todo. Secrets en app_config invisibles para no-admins.
**Dependencias**: Ninguna (pero debe desplegarse con cuidado).
**Riesgo**: Si la policy está mal, la app se rompe para todos. Requiere testing manual exhaustivo.

### S9.3 — Secrets a env vars + proteger app_config (Size: M)
**Qué**: Configurar `openai_api_key`, `meta_access_token`, etc. como Supabase Secrets. Modificar 10+ funciones para leer de `Deno.env.get()` en vez de app_config. Eliminar las filas SECRET de app_config. Actualizar frontend para no leer/enviar tokens.
**Entregable**: `Deno.env.get('OPENAI_API_KEY')` funciona en todas las funciones. app_config no contiene secrets.
**Dependencias**: S9.1 (auth middleware ya existe, algunas funciones lo necesitan).

### S9.4 — CORS restrictivo + hardening final (Size: S)
**Qué**: Modificar `_shared/cors.ts` para verificar Origin contra allowlist. Eliminar corsHeaders inline de 8 funciones. Agregar security headers faltantes.
**Entregable**: CORS rechaza requests de dominios no autorizados. Todas las funciones usan `_shared/cors.ts`.
**Dependencias**: S9.1 (para no romper las funciones ya protegidas).

## Grafo de dependencias

```
S9.1 (Auth middleware) ──┬──→ S9.3 (Secrets)
                         └──→ S9.4 (CORS)
S9.2 (RLS) ─────────────────→ (independiente)
```

S9.1 y S9.2 pueden ejecutarse en paralelo. S9.3 y S9.4 dependen de S9.1.

## Done Criteria (medibles)

1. `curl -X POST .../system-wipe` sin Authorization header → 401
2. `curl -X POST .../system-wipe -H "Authorization: Bearer <agent_jwt>"` → 403
3. `curl -X POST .../system-wipe -H "Authorization: Bearer <admin_jwt>" -d '{"confirmation":"FACTORY_RESET"}'` → 200
4. Query `supabase.from('app_config').select('*')` como agent → no retorna filas con `category = 'SECRET'`
5. Query `supabase.from('leads').select('*')` como agent → solo retorna leads con `assigned_to = <user_id>`
6. `evolution-webhook` sigue procesando mensajes de WhatsApp sin auth
7. CORS: `fetch` desde `http://evil.com` → bloqueado por browser

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| RLS mal configurado rompe la app | Alta | Crítico | Testear cada policy con queries de admin y agent antes de deploy. Tener SQL de rollback listo. |
| Migrar secrets rompe funciones en producción | Media | Alto | Configurar env vars ANTES de desplegar nuevas funciones. Ventana de migración con ambos paths activos. |
| Crons dejan de funcionar si auth es demasiado restrictiva | Media | Alto | Las funciones de cron usan service_role_key → bypasean RLS. Solo necesitan mantener --no-verify-jwt. |

## Parking Lot (deferred)

- Supabase Vault para secrets → si env vars funcionan, no es necesario
- Rate limiting en webhooks → nice-to-have, no bloquea
- Auditoría de auth events → E10 o posterior
- CHECK constraint en profiles.role → hacer después de consolidar la lista de roles
- Revocar GRANT ALL de FIX_PERMISSIONS.sql para rol anon → incluir en S9.2 migration
