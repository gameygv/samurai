# S11.5 — IA extrae C.P. automáticamente en analyze-leads

## Objetivo
Agregar extracción de código postal (cp) al análisis de IA en analyze-leads.

## Cambios
- Modificar prompt de GPT para pedir cp (5 dígitos numéricos)
- Parsear y validar cp del response (regex /^\d{5}$/)
- Guardar cp en updates si es válido

## Archivos
- supabase/functions/analyze-leads/index.ts

## Criterios de aceptación
- El prompt incluye instrucción para extraer cp
- El JSON de respuesta incluye campo cp
- Solo se guarda si son exactamente 5 dígitos
- No se sobreescribe cp existente con null
- Sin cambios al modelo, temperatura u otro comportamiento
