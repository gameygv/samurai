---
epic: E6
name: chatbot-intelligence
status: complete
created: 2026-03-31
predecessor: E5
---

# E6: Chatbot Intelligence — Completar Flujos Automáticos

## Hypothesis

La auditoría del chatbot reveló que varias funcionalidades tienen la infraestructura
(UI, prompts, funciones) pero les falta la conexión automática: Ojo de Halcón no
analiza comprobantes del chat, Verdad Maestra no se actualiza sola, CAPI no se
dispara automáticamente, y el contenido OCR no llega al AI. Conectando estas piezas,
el bot opera de forma completamente autónoma.

## Success Metrics

- Comprobantes de pago enviados por WhatsApp se analizan automáticamente
- Verdad Maestra se actualiza diariamente a las 3am sin intervención
- Eventos CAPI se disparan automáticamente cuando el bot detecta conversiones
- OCR content de imágenes analizadas accesible para el AI
- Zero regression en flujo normal de mensajes

## Appetite

5 stories, ~2 sesiones de trabajo.

## Rabbit Holes

- No implementar aprobación automática de pagos (solo análisis + aviso al agente)
- No hacer OCR en tiempo real de cada imagen recibida (solo comprobantes)
- No rediseñar el sistema de prompts completo
- No implementar CAPI para todos los eventos posibles (solo Lead y Purchase)
