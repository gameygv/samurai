# E11: Academia & Expediente del Cliente

## Hypothesis

Si vinculamos el historial académico con Media Manager, enriquecemos la ficha del contacto con datos de perfil (dieta, alergias, motivo), y le damos a la IA contexto del alumno, el CRM se convierte en un sistema completo de gestión de alumnos — no solo de ventas. Los agentes podrán ofrecer cursos relevantes, la IA evitará re-vender cursos ya tomados, y el Centro Financiero mostrará cuánto falta por liquidar.

## Success Metrics

- [ ] Expediente Maestro con 3 tabs: Datos Base, Ficha Curricular, Notas del Perfil
- [ ] Cada inscripción vinculada a media_asset con precio dado y asistencia
- [ ] Centro Financiero muestra "Por Liquidar" (deuda - pagado)
- [ ] IA extrae C.P. automáticamente para Meta CAPI
- [ ] Filtros avanzados en Contactos: multi-etiqueta, curso, sede, profesor, fechas, saldo
- [ ] Catálogo de cursos con vista grid/lista y filtros
- [ ] IA sabe qué cursos ya tomó el contacto

## Appetite

3-4 semanas. 8 stories.

## Rabbit Holes (evitar)

- No crear una tabla separada para inscripciones — academic_record JSONB en contacts es suficiente para este volumen
- No rediseñar el flujo de pagos completo — solo agregar la columna "Por Liquidar" y el precio dado
- No hacer que la IA inscriba automáticamente — la inscripción es manual por el agente
- No migrar academic_record a nuevo formato — backward compatible, campos opcionales
