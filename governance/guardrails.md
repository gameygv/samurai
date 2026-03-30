---
type: guardrails
version: "1.0.0"
---

# Guardrails: samurai

> Code and architecture guardrails for the SAMURAI CRM platform

---

## Guardrails Activos

### Code Quality

| ID | Level | Guardrail | Verification | Derived from |
|----|-------|-----------|--------------|--------------|
| MUST-CQ-01 | must | TypeScript estricto en frontend — usar tipos explícitos, no `any` | `npx tsc --noEmit` | AI_RULES.md |
| MUST-CQ-02 | must | Componentes React < 100 líneas, un archivo por componente | Code review | AI_RULES.md |
| MUST-CQ-03 | must | Usar shadcn/ui como librería de componentes base | Code review | AI_RULES.md |
| MUST-CQ-04 | must | Tailwind CSS para todo el styling — no CSS custom | Code review | AI_RULES.md |
| SHOULD-CQ-05 | should | Rutas definidas en src/App.tsx — no routing distribuido | Code review | AI_RULES.md |

### Architecture

| ID | Level | Guardrail | Verification | Derived from |
|----|-------|-----------|--------------|--------------|
| MUST-AR-01 | must | Backend exclusivamente en Supabase Edge Functions (Deno) | Deployment check | Stack decision |
| MUST-AR-02 | must | Datos PII hasheados con SHA-256 antes de enviar a Meta CAPI | Unit test | RF-03 |
| MUST-AR-03 | must | Leads nuevos protegidos 24h — no asignar PERDIDO automáticamente | Edge function logic | Bug fix c46e2e6 |
| SHOULD-AR-04 | should | Edge functions deben usar _shared/cors.ts para headers CORS | Code review | Convention |
| SHOULD-AR-05 | should | Supabase client inicializado desde src/integrations/supabase/client.ts — no instancias duplicadas | Grep check | Convention |

### Security

| ID | Level | Guardrail | Verification | Derived from |
|----|-------|-----------|--------------|--------------|
| MUST-SE-01 | must | API keys y secrets en app_config (categoría SECRETS), nunca hardcoded en código | Grep check | Best practice |
| MUST-SE-02 | must | RLS habilitado en todas las tablas de Supabase | DB audit | Best practice |
| SHOULD-SE-03 | should | Role-based access control en rutas del frontend | Code review | AuthContext |

### AI Agent

| ID | Level | Guardrail | Verification | Derived from |
|----|-------|-----------|--------------|--------------|
| MUST-AI-01 | must | Instrucciones #CIA siempre vinculadas a contexto de chat — nunca genéricas | UI enforcement | AI_RULES.md |
| MUST-AI-02 | must | Jerarquía de verdad: Layer 1 (#CIA) > Layer 3 (Website Content) para datos técnicos | Prompt review | AI_RULES.md |
| SHOULD-AI-03 | should | Prompt versions snapshotted antes de modificar | Edge function logic | RF-08 |
