# E11: Academia & Expediente del Cliente — Scope

## Objective

Transformar SAMURAI de un CRM de ventas a un sistema de gestión de alumnos integrado: expediente enriquecido, historial académico vinculado a Media Manager, centro financiero con saldos, filtros avanzados, y contexto académico para la IA.

## Value

Hoy el CRM no sabe qué cursos tomó un alumno, qué le debe, ni sus necesidades dietéticas. Los agentes operan a ciegas. Después de E11:
- Cada contacto tiene un expediente completo (datos + curricular + notas de perfil)
- Cada inscripción está vinculada al poster/curso en Media Manager con precio y asistencia
- El Centro Financiero muestra cuánto falta por liquidar
- La IA no revende cursos ya tomados y extrae C.P. automáticamente
- Los contactos se filtran por curso, sede, profesor, fechas y saldo

## In Scope (MUST)

- 4 nuevas columnas en contacts: dieta, alimentacion, alergias, motivo_curso
- Expediente Maestro: dialog con 3 tabs (Datos Base, Ficha Curricular, Notas del Perfil)
- academic_record enriquecido: asset_id, precio_dado, tipo_precio, asistencia, nivel, profesor
- Centro Financiero: columna "Por Liquidar" + precio_tipo/precio_original en credit_sales
- analyze-leads extrae C.P. del chat y lo guarda
- Filtros avanzados en Contactos: multi-etiqueta, curso, sede, profesor, fechas, saldo
- get-samurai-context incluye academic_record del contacto

## In Scope (SHOULD)

- Catálogo de cursos mejorado: vista grid/lista con filtros y conteo de alumnos
- Vincular inscripción desde Media Manager (click en poster → inscribir alumno)

## Out of Scope

- Tabla separada para inscripciones (JSONB es suficiente)
- Inscripción automática por IA
- Generación de certificados
- Sistema de calificaciones
- Notificaciones de cursos próximos

## Stories

| ID | Name | Size | Dependencies |
|----|------|------|-------------|
| S11.1 | Migration: columnas de perfil + precio en credit_sales | S | — |
| S11.2 | Expediente Maestro: 3 tabs (Datos Base + Ficha Curricular + Notas Perfil) | L | S11.1 |
| S11.3 | Vincular academic_record con media_assets: asset_id, precio, asistencia | M | S11.2 |
| S11.4 | Centro Financiero: "Por Liquidar" + precio dado | M | S11.1 |
| S11.5 | IA extrae C.P. automáticamente en analyze-leads | S | — |
| S11.6 | Filtros avanzados en Directorio de Contactos | M | S11.1, S11.3 |
| S11.7 | Catálogo de cursos mejorado: grid/lista con filtros | L | S11.3 |
| S11.8 | get-samurai-context incluye academic_record del contacto | S | S11.3 |

## Done Criteria

1. Expediente Maestro abre con 3 tabs funcionales
2. Ficha Curricular muestra cursos con asistencia, vinculados a media_assets
3. Notas del Perfil muestra dieta, alimentación, alergias, motivo
4. Centro Financiero muestra "Por Liquidar" correctamente
5. C.P. se extrae automáticamente del chat
6. Contactos se filtran por curso, sede, profesor, fechas y saldo
7. IA no re-ofrece cursos ya tomados
8. npm test + deno test + build pasan
