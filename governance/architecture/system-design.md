---
type: architecture_design
project: "samurai"
status: active
layers:
  - name: "Frontend"
    description: "React SPA con TypeScript, Tailwind y shadcn/ui"
  - name: "Edge Functions"
    description: "Supabase Edge Functions en Deno para lógica de backend"
  - name: "Database"
    description: "PostgreSQL en Supabase con RLS"
  - name: "External Services"
    description: "OpenAI, Meta CAPI, WhatsApp, WooCommerce"
---

# System Design: samurai

> C4 Level 2 — Container/component decomposition

## Architecture Overview

SAMURAI sigue una arquitectura serverless con un SPA (React) que se comunica con Supabase Edge Functions para toda la lógica de backend. La base de datos PostgreSQL en Supabase almacena leads, conversaciones, configuración y eventos. Las Edge Functions orquestan la integración con WhatsApp, OpenAI y Meta CAPI.

## Components

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| **Dashboard SPA** | UI para agentes y admins: inbox, leads, pipeline, config, analytics | React 19, TypeScript, Tailwind, shadcn/ui |
| **Auth & Roles** | Autenticación y control de acceso por rol (admin, dev, manager, gerente, sales_agent) | Supabase Auth, AuthContext.tsx |
| **Chat Engine** | Inbox de WhatsApp con historial, sugerencias IA, panel de memoria del lead | React components (chat/*), useRealtimeMessages |
| **AI Agent (Sam)** | Agente conversacional que sigue protocolo 3 fases con contexto dinámico | Edge: process-samurai-response, get-samurai-context, OpenAI |
| **Lead Manager** | Gestión de leads: scoring, intent tracking, funnel, tags, asignación | Edge: analyze-leads, DB: leads table |
| **Message Router** | Envío/recepción multi-proveedor WhatsApp con normalización de números MX | Edge: send-message-v3, evolution-webhook |
| **Meta CAPI Bridge** | Envío de eventos de conversión con hashing PII y tracking EMQ | Edge: meta-capi-sender, DB: meta_capi_events |
| **Financial Module** | Ventas a crédito, parcialidades, recordatorios, verificación de pagos | Edge: process-credit-reminders, DB: credit_sales/installments |
| **Knowledge Engine** | Base de conocimiento: docs, scraping web, productos WC → contexto IA | Edge: auto-sync-knowledge, scrape-website, DB: knowledge_documents |
| **Learning System (CIA)** | Reporte de errores IA vinculados a contexto, correcciones, prompt versioning | Edge: manage-prompt-versions, DB: errores_ia, prompt_versions |
| **Media Manager** | Assets visuales con triggers por keyword/ciudad para inyección en respuestas | DB: media_assets, AI instructions |
| **Campaign Engine** | Scheduling de campañas WhatsApp, filtrado de contactos, envío masivo | Edge: process-campaign-queue, DB: app_config |
| **Followup Automation** | Recordatorios y seguimiento automático basado en reglas configurables | Edge: process-followups, DB: followup_config/history |

## Key Decisions

- **Supabase como backend completo**: Auth, DB, Edge Functions, Realtime — evita gestionar infraestructura separada
- **Multi-proveedor WhatsApp**: Redundancia y flexibilidad con Meta Cloud API + Gowa + Standard
- **Contexto dinámico IA**: El prompt del agente se construye en runtime combinando website content, knowledge base, media y productos
- **#CIA contextual**: Las correcciones al agente siempre nacen del contexto de una conversación real, nunca genéricas
- **Kommo CRM deprecated**: La integración con Kommo será eliminada — el CRM interno de SAMURAI es la fuente de verdad
