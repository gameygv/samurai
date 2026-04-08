# E9: Security Hardening — Scope

## Objective

Cerrar los gaps de seguridad críticos identificados en la auditoría del 2026-04-07: autenticación en Edge Functions, RLS real, protección de secrets y CORS restrictivo.

## Value

Hoy cualquier persona en internet puede invocar `system-wipe` y borrar toda la base de datos. Cualquier agente de ventas puede leer las API keys de OpenAI y Meta. Después de E9:
- Solo admins pueden ejecutar operaciones destructivas
- Agentes solo ven y modifican sus propios datos
- Secrets protegidos por rol
- CORS limita requests al dominio de producción

## In Scope (MUST)

- Auth middleware compartido para Edge Functions (`_shared/auth.ts`)
- Integrar auth en funciones admin: system-wipe, admin-create-user, admin-reset-password, manage-auth-users, update-user-email
- RLS policies reales basadas en roles para: leads, conversaciones, contacts, app_config, whatsapp_channels
- Mover secrets de app_config a Deno.env.get() en Edge Functions
- CORS restrictivo (dominio de producción, no wildcard)

## In Scope (SHOULD)

- Proteger app_config por categoría (secrets vs config pública)
- Rate limiting básico en funciones públicas (webhooks)

## Out of Scope

- Supabase Vault (complejidad innecesaria si env vars funcionan)
- Sistema de permisos granular (roles simples son suficientes)
- Rotación automática de keys
- CI/CD security scanning (Epic 10)
- Auditoría de acceso / logging de auth events

## Planned Stories

| ID | Name | Size | Dependencies |
|----|------|------|-------------|
| S9.1 | Auth middleware + proteger funciones admin | M | — |
| S9.2 | RLS policies reales por rol | L | — |
| S9.3 | Secrets a env vars + proteger app_config | M | S9.1 |
| S9.4 | CORS restrictivo + hardening final | S | S9.1 |

## Done Criteria

1. `system-wipe` retorna 401 sin JWT válido de admin
2. Un agente no puede leer `openai_api_key` de app_config
3. Un agente solo ve leads/contacts asignados a él (verificado via Supabase)
4. CORS rechaza requests desde dominios no autorizados
5. `evolution-webhook` sigue funcionando sin JWT (es llamado por servicios externos)
6. Todas las funciones admin requieren rol admin/dev
