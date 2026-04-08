# S11.6: Filtros avanzados en Directorio de Contactos

## Objective
Add advanced filters to the Contacts directory: Curso, Sede, Profesor (multi-select from academic_record), date range, and Saldo filter.

## Acceptance Criteria
1. Multi-select filter for Curso (extracted from academic_record.course)
2. Multi-select filter for Sede (extracted from academic_record.location)
3. Multi-select filter for Profesor (extracted from academic_record.teacher)
4. Date range filter (from/to) for academic_record dates
5. Saldo filter: Cualquier Saldo / Con Deuda Activa / Sin Deuda
6. All existing filters continue working
7. Filters compose (AND logic)
8. Build passes, no type errors

## Tasks
1. Extract unique courses/sedes/profesores from contacts' academic_records
2. Add filter state variables for new filters
3. Add multi-select filter UI components (Curso, Sede, Profesor) using existing Popover/Command pattern
4. Add date range inputs (from/to)
5. Add Saldo dropdown filter
6. Apply all new filters to filteredContacts computation
7. Update hasActiveFilters to include new filters
8. Verify build passes

## Dependencies
- S11.1 (profile columns), S11.3 (academic_record enrichment)
