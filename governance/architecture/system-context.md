---
type: architecture_context
project: "samurai"
status: active
tech_stack:
  frontend: "React 19 + TypeScript + Vite + Tailwind/shadcn"
  backend: "Supabase Edge Functions (Deno)"
  database: "Supabase PostgreSQL"
  ai: "OpenAI GPT"
  messaging: "WhatsApp (Meta Cloud API, Gowa/Evolution, Standard)"
external_dependencies:
  - "Meta Conversion API (CAPI)"
  - "OpenAI API"
  - "WooCommerce"
  - "WhatsApp Business API (Meta/Gowa/Standard)"
users:
  - "Agentes de ventas (2)"
  - "Administradores"
  - "Clientes (vía WhatsApp)"
governed_by:
  - "RF-01 through RF-08"
---

# System Context: samurai

> C4 Level 1 — System Context diagram and description

## Overview

SAMURAI es un CRM conversacional con IA para The Elephant Bowl. Recibe mensajes de clientes potenciales vía WhatsApp, los procesa con un agente IA (Sam) que sigue un protocolo de ventas de 3 fases, extrae datos en tiempo real para alimentar Meta CAPI y optimizar campañas de Facebook Ads. Los agentes de ventas supervisan y corrigen al bot desde un dashboard web.

## Context Diagram

```
┌──────────────┐     WhatsApp      ┌──────────────────┐    CAPI Events    ┌──────────────┐
│   Clientes   │◄────────────────►│     SAMURAI      │──────────────────►│  Facebook    │
│  (WhatsApp)  │    Mensajes       │   CRM + AI Bot   │                   │  Ads / Meta  │
└──────────────┘                   │                  │                   └──────────────┘
                                   │  React + Supabase│
┌──────────────┐     Dashboard     │  + Edge Functions │    Payment Links  ┌──────────────┐
│   Agentes    │◄────────────────►│  + OpenAI        │◄────────────────►│ WooCommerce  │
│  de Ventas   │    Web App        │                  │   Verify Payments  │  (Pagos)     │
└──────────────┘                   └──────────────────┘                   └──────────────┘
                                          │
                                          │ AI Completions
                                          ▼
                                   ┌──────────────┐
                                   │   OpenAI     │
                                   │   GPT API    │
                                   └──────────────┘
```

## External Interfaces

| System | Direction | Protocol | Description |
|--------|-----------|----------|-------------|
| WhatsApp (Meta Cloud API) | Bidirectional | HTTPS/Webhook | Envío y recepción de mensajes, media |
| WhatsApp (Gowa/Evolution) | Bidirectional | HTTPS/Webhook | Proveedor alternativo de WhatsApp |
| Meta Conversion API | Outbound | HTTPS | Eventos de conversión con datos hasheados SHA-256 |
| OpenAI API | Outbound | HTTPS | Completions para agente conversacional, análisis y perfilamiento |
| WooCommerce | Bidirectional | HTTPS/REST | Links de pago, verificación de pagos, catálogo de productos |
| Supabase | Internal | HTTPS/WebSocket | Base de datos PostgreSQL, Auth, Realtime, Storage |
