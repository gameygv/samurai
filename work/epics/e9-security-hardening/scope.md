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
