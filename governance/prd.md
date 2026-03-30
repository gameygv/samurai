# PRD: samurai

> Product Requirements Document — The Elephant Bowl Sales Automation Platform

---

## Problem

The Elephant Bowl vende cursos de cuencoterapia y necesita convertir leads de campañas de Facebook Ads en ventas cerradas a través de WhatsApp. El proceso manual de captura de datos, seguimiento y envío de eventos a Meta CAPI es lento e inconsistente, lo que degrada la calidad de las señales enviadas a Facebook y reduce el rendimiento de las campañas.

## Goals

- Capturar datos de leads desde conversaciones de WhatsApp lo antes posible
- Alimentar Meta CAPI con eventos de alta calidad (EMQ alto) para optimizar campañas
- Automatizar el ciclo de ventas con un agente IA que sigue un protocolo de 3 fases
- Generar perfiles psicográficos para timing y segmentación óptima

---

## Requirements

### RF-01: Agente Conversacional IA

El sistema debe operar un agente IA ("Sam") sobre WhatsApp que siga un protocolo de 3 fases: (1) captura de datos sin soltar precios, (2) seducción visual con posters por ciudad, (3) cierre con manejo de objeciones y links de pago. El agente debe detectar estados emocionales del cliente y adaptar su presión de venta.

### RF-02: Análisis Conversacional en Tiempo Real

El sistema debe analizar cada mensaje entrante para extraer datos del lead (nombre, email, ciudad, estado emocional, intención de compra) y actualizar el CRM automáticamente. La extracción debe ocurrir lo antes posible para alimentar Meta CAPI con datos frescos.

### RF-03: Integración Meta CAPI

El sistema debe enviar eventos de conversión (Lead, Purchase, etc.) a Facebook Ads vía Conversion API con datos hasheados (SHA-256). Debe mantener un EMQ (Event Match Quality) alto mediante la captura progresiva de datos del cliente desde las conversaciones.

### RF-04: Perfilamiento Psicográfico

El sistema debe generar perfiles psicográficos de cada lead usando OpenAI, basándose en el análisis de sus conversaciones, para determinar el momento óptimo de envío de eventos y mensajes.

### RF-05: Gestión Multi-Canal WhatsApp

El sistema debe soportar múltiples proveedores de WhatsApp (Meta Cloud API, Gowa/Evolution, Standard API) con routing dinámico por canal, para garantizar disponibilidad y escalabilidad.

### RF-06: Gestión Financiera y Pagos

El sistema debe gestionar ventas a crédito con parcialidades, integrar con WooCommerce para generar links de pago, verificar pagos completados y registrarlos en el CRM. Debe enviar recordatorios de pago automáticos.

### RF-07: Knowledge Base y Contexto Dinámico

El sistema debe mantener una base de conocimiento (documentos, scraping web, productos WooCommerce) que se inyecta como contexto al agente IA, asegurando respuestas precisas sobre precios, fechas y contenido del curso.

### RF-08: Sistema de Aprendizaje (CIA)

El sistema debe permitir reportar errores del agente IA (#CIA) vinculados al contexto de la conversación, aplicar correcciones a los prompts y rastrear la tasa de mejora post-corrección.
