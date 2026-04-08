# S11.6 Retrospective — Filtros avanzados en Directorio de Contactos

## Outcome: DONE

## What was delivered
- 5 new filters added to the Contacts directory filter bar:
  1. **Curso** — multi-select popover listing unique courses from academic_records
  2. **Sede** — multi-select popover listing unique locations from academic_records
  3. **Profesor** — multi-select popover listing unique teachers from academic_records
  4. **Fechas** — date range inputs (from/to) filtering by academic_record dates
  5. **Saldo** — dropdown: Cualquier Saldo / Con Deuda Activa / Sin Deuda
- All filters compose with AND logic alongside existing filters
- Unique values extracted via useMemo for performance
- UI follows existing Popover/Command pattern (same as tags filter)
- Build passes, no type errors

## What went well
- Existing codebase had clear patterns to follow (tags popover, financial status select)
- academic_record JSONB structure was consistent across the codebase
- Single-file change — all logic contained in Contacts.tsx

## Files modified
- `src/pages/Contacts.tsx` — +178 lines (filters, state, UI, extraction logic)

## Decisions
- Multi-select filters only shown when relevant data exists (conditional rendering)
- Date comparison uses string comparison (ISO format, works correctly)
- Saldo filter reuses existing `debtFilter` state (was already defined but had no UI)
