# Edge Functions — JWT Policy

## Contexto

Supabase migró las claves JWT de usuario de HS256 (secret compartido) a ES256
(asimétrico, con KID rotativo). Las edge functions **con JWT verify activado**
no aceptan tokens ES256 — devuelven `401 Invalid JWT` al instante.

Esto rompió 2026-04-10 el flujo de diagnóstico CAPI, donde el dialog en el
frontend llamaba `supabase.functions.invoke('get-capi-diagnostic')` y la
función rechazaba el token del usuario con 401. El SDK reporta esto como
`Edge Function returned a non-2xx status code` sin decir que era 401.

## Política

### Funciones con `--no-verify-jwt` (SIN verificación de JWT)

Se redeployan así cuando son **invocables desde el frontend del usuario final**
y solo hacen operaciones read-only o escritas gated por RLS vía service_role:

- `analyze-leads` — clasifica intent, idempotente, solo update del propio lead
- `analyze-receipt` — analiza imagen, idempotente
- `get-capi-diagnostic` — read-only diagnóstico
- `get-ai-suggestions` — read-only GPT suggest
- `get-samurai-context` — read-only config
- `evaluate-agent` — audit log
- `simulate-samurai` — GPT dry-run
- `send-message-v3` — manda WhatsApp (uso legítimo del agente, verifica lead asignado internamente)
- `audit-chat-performance` — read-only
- `test-wc-connection` — read-only prueba
- `meta-wa-capi-verify` — verificación de webhook de Meta
- `scrape-website`, `scrape-main-website` — read-only fetch
- `process-capi-purchase` — drain de cola, llamado por cron
- `evolution-webhook` — **CRÍTICO** entry point de webhooks WhatsApp (GOWA + Meta). NUNCA con JWT. Ver INCIDENTE 2026-04-20.
- `media-proxy` — proxy de media con auth del canal
- `transcribe-audio` — llamado desde webhook con service_role
- `recover-lost-messages` — función de emergencia para recuperar mensajes de GOWA
- `backfill-geo-enrichment` — llamado por cron
- `get-lead-context` — read-only contexto de lead
- `process-samurai-response` — llamado desde webhook/analyze-leads
- `process-followups` — llamado por cron
- `process-lead-reminders` — llamado por cron
- `process-credit-reminders` — llamado por cron
- `process-campaign-queue` — llamado por cron
- `auto-sync-knowledge` — llamado por cron

### Funciones CON JWT verify (default)

Operaciones sensibles que **requieren autenticación fuerte**, solo accesibles
desde UI de admin o panel interno. Si se rompen por el issue de ES256, la
solución es **verificar el JWT manualmente** usando `jose` library en el
cuerpo de la función (comparando contra JWKS de Supabase en runtime), NO
desactivando `--no-verify-jwt`:

- `admin-create-user`
- `manage-auth-users`
- `system-wipe`
- `update-user-email`
- `manage-prompt-versions`
- `tune-samurai-prompts`
- `setup-whatsapp-webhook`
- `meta-capi-sender` — siempre llamada por otras funciones con service_role

## INCIDENTE 2026-04-20: evolution-webhook desplegada sin --no-verify-jwt

**Causa:** Durante sesión de emergencia (SES-040, 2026-04-20 ~07:48 UTC), se redesplegó
`evolution-webhook` sin el flag `--no-verify-jwt`. GOWA comenzó a recibir 401 en todos
los webhooks.

**Impacto:** ~24 horas sin mensajes entrantes al CRM. 328 mensajes de clientes perdidos
(184 contactos afectados). Eventos CAPI no generados durante ese periodo.

**Resolución:** Se arregló el flag (2026-04-21 ~09:00 UTC), se creó `recover-lost-messages`
para reinyectar mensajes desde la API de GOWA, y se desplegó el script `deploy.sh` para
evitar que vuelva a ocurrir.

**Lección:** SIEMPRE usar `deploy.sh` para desplegar funciones. NUNCA hacer deploy manual
de funciones que aparecen en la lista `--no-verify-jwt`.

## Cómo re-deployar

**SIEMPRE usar el script `deploy.sh`** — aplica `--no-verify-jwt` automáticamente:

```bash
# Deploy seguro (aplica --no-verify-jwt según política):
./deploy.sh <nombre>

# Deploy todas las funciones:
./deploy.sh --all

# Si NECESITAS hacerlo manual (NO RECOMENDADO):
PYTHONIOENCODING=utf-8 npx supabase functions deploy <nombre> --no-verify-jwt
```

## Debug si vuelve a pasar

```bash
# 1. Obtener JWT fresco
JWT=$(curl -s -X POST "https://<proyecto>.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"email":"<user>","password":"<pass>"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 2. Inspeccionar algoritmo del token
echo $JWT | cut -d. -f1 | base64 -d 2>/dev/null
# Si dice "ES256" → el problema del issue actual

# 3. Llamar función con JWT real
curl -X POST "https://<proyecto>.supabase.co/functions/v1/<nombre>" \
  -H "Authorization: Bearer $JWT" -H "apikey: <ANON_KEY>" \
  -d '{...}'
# Si 401 Invalid JWT → redeploy con --no-verify-jwt
```
