---
epic: E7
name: gowa-media-and-data-quality
status: in-progress
created: 2026-03-31
predecessor: E6
---

# E7: Gowa Media Support & Data Quality

## Hypothesis

Los canales Gowa/Evolution envian URLs directas de media (imagenes, audio) en sus
webhooks pero el codigo las ignora — solo lee captions. Ademas, informacion de cursos
expirados persiste en Base de Conocimiento y Verdad Maestra sin filtro de fecha,
causando que el bot recomiende talleres pasados. Corrigiendo ambos, el sistema opera
correctamente con todos los providers y con datos siempre actualizados.

## Success Metrics

- Imagenes y audio de canales Gowa procesados (transcripcion, Ojo de Halcon)
- Cero cursos expirados recomendados por el bot (de cualquier fuente)
- Cron de recordatorios cada 15 min (reduce delay de 59 a 14 min)
- Auto-reactivar IA cuando agente olvida encenderla
- Zero regression en canales Meta

## Appetite

5-6 stories, ~2 sesiones de trabajo.

## Rabbit Holes

- No implementar nuevo provider (solo soportar Gowa + Evolution existentes)
- No hacer streaming de audio (descargar completo y transcribir)
- No rediseñar el sistema de scraping para filtro de fechas (solo limpiar datos)
- No implementar recordatorios al cliente (solo mejorar cron frequency)
