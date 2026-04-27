#!/bin/bash
# deploy.sh — Deploy seguro de Supabase Edge Functions
#
# Este script aplica automáticamente --no-verify-jwt a las funciones que lo necesitan.
# SIEMPRE usar este script en vez de `supabase functions deploy` directo.
#
# INCIDENTE 2026-04-20: evolution-webhook desplegada sin --no-verify-jwt causó
# ~24h de pérdida de mensajes (328 mensajes, 184 contactos). Este script existe
# para que eso NUNCA vuelva a pasar.
#
# Uso:
#   ./deploy.sh <nombre-funcion>     Deploy una función
#   ./deploy.sh --all                Deploy todas las funciones
#   ./deploy.sh --list               Listar funciones y su política JWT

PROJECT_REF="giwoovmvwlddaizorizk"

# ══════════════════════════════════════════════════════════════════════
# FUNCIONES QUE REQUIEREN --no-verify-jwt
# Si agregas una función nueva que recibe webhooks, es llamada por cron,
# o por otras funciones: AGRÉGALA AQUÍ.
# ══════════════════════════════════════════════════════════════════════
NO_VERIFY_JWT=(
  # Webhooks (externos → función)
  "evolution-webhook"
  "meta-wa-capi-verify"

  # Llamadas inter-función (función → función)
  "analyze-leads"
  "analyze-receipt"
  "get-samurai-context"
  "get-lead-context"
  "send-message-v3"
  "process-samurai-response"
  "transcribe-audio"
  "media-proxy"

  # Cron jobs
  "health-check-pipeline"
  "process-followups"
  "process-lead-reminders"
  "process-campaign-queue"
  "process-capi-purchase"
  "auto-sync-knowledge"
  "backfill-geo-enrichment"

  # Grupos WhatsApp (E12 — llamadas desde frontend)
  "list-whatsapp-groups"
  "sync-group-members"
  "send-group-message"

  # Sync de canales/grupos (E13 — cron + manual desde UI)
  "sync-channel-groups"

  # Frontend read-only / diagnóstico
  "get-capi-diagnostic"
  "get-ai-suggestions"
  "evaluate-agent"
  "simulate-samurai"
  "audit-chat-performance"
  "test-wc-connection"
  "scrape-website"
  "scrape-main-website"

  # Utilidades de emergencia
  "recover-lost-messages"
)

# ══════════════════════════════════════════════════════════════════════
# FUNCIONES CON JWT verify (operaciones admin sensibles)
# ══════════════════════════════════════════════════════════════════════
VERIFY_JWT=(
  "admin-create-user"
  "admin-reset-password"
  "manage-auth-users"
  "manage-prompt-versions"
  "tune-samurai-prompts"
  "setup-whatsapp-webhook"
  "update-user-email"
  "system-wipe"
  "meta-capi-sender"
)

# ──────────────────────────────────────────────────────────────────────
is_no_verify() {
  local fn="$1"
  for f in "${NO_VERIFY_JWT[@]}"; do
    [[ "$f" == "$fn" ]] && return 0
  done
  return 1
}

deploy_function() {
  local fn="$1"
  local fn_dir="supabase/functions/$fn"

  if [ ! -d "$fn_dir" ]; then
    echo "❌ Función '$fn' no encontrada en $fn_dir"
    return 1
  fi

  if is_no_verify "$fn"; then
    echo "🔓 Deploying $fn (--no-verify-jwt)"
    PYTHONIOENCODING=utf-8 npx supabase functions deploy "$fn" --no-verify-jwt --project-ref "$PROJECT_REF"
  else
    echo "🔒 Deploying $fn (con JWT verify)"
    PYTHONIOENCODING=utf-8 npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF"
  fi

  if [ $? -eq 0 ]; then
    echo "✅ $fn desplegada correctamente"
  else
    echo "❌ Error desplegando $fn"
    return 1
  fi
}

# ──────────────────────────────────────────────────────────────────────
case "$1" in
  --list)
    echo "══ Funciones --no-verify-jwt ══"
    for fn in "${NO_VERIFY_JWT[@]}"; do echo "  🔓 $fn"; done
    echo ""
    echo "══ Funciones con JWT verify ══"
    for fn in "${VERIFY_JWT[@]}"; do echo "  🔒 $fn"; done
    ;;

  --all)
    echo "🚀 Deploying ALL functions..."
    errors=0
    for fn in "${NO_VERIFY_JWT[@]}" "${VERIFY_JWT[@]}"; do
      deploy_function "$fn" || ((errors++))
      echo ""
    done
    echo "══ Resultado: $((${#NO_VERIFY_JWT[@]} + ${#VERIFY_JWT[@]} - errors)) OK, $errors errores ══"
    ;;

  "")
    echo "Uso: ./deploy.sh <nombre-funcion> | --all | --list"
    echo ""
    echo "  ./deploy.sh evolution-webhook    Deploy una función"
    echo "  ./deploy.sh --all                Deploy todas"
    echo "  ./deploy.sh --list               Listar política JWT"
    ;;

  *)
    deploy_function "$1"
    ;;
esac
