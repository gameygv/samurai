---
epic: E5
name: multichannel-hardening
status: complete
created: 2026-03-30
predecessor: E4
---

# E5: Multi-Channel Hardening

## Hypothesis

El sistema soporta multiples canales WhatsApp (Meta + Gowa) pero tiene gaps criticos:
la IA responde 24/7 ignorando el horario configurado, los recordatorios por lead se
crean pero nunca se envian, no hay auto-routing por ciudad, y la transcripcion de
audio falla en canales Gowa. Corrigiendo estos gaps, el sistema queda listo para
produccion con 3 canales simultaneos y agentes independientes.

## Success Metrics

- IA respeta horario configurado por agente (no responde fuera de horas)
- Recordatorios por lead se envian automaticamente por WhatsApp
- Leads asignados automaticamente al agente mas cercano por ciudad
- Transcripcion de audio funciona independientemente del provider
- Canal Gowa dedicado para avisos/recordatorios funciona correctamente
- Zero regression en flujo de mensajes normal

## Appetite

7 stories, ~2-3 sesiones de trabajo.

## Rabbit Holes

- No redisenar el sistema de canales completo
- No implementar token auto-refresh de Meta
- No migrar datos historicos entre canales
- No implementar transcripcion de audio para Gowa (solo Meta soporta Graph API media)
- No construir un scheduler complejo — cron cada hora es suficiente
