# S11.7: Catalogo de cursos mejorado — grid/lista con filtros

## Objective
Upgrade AcademicCatalog from a simple name-list manager to a rich course catalog
that displays media_assets as course cards with filters, enrollment counts, and
grid/list toggle, while preserving the existing catalog configuration section.

## In Scope
- Filter bar: profesor, sede, nivel, category, month
- Grid view with course cards (poster, title, badges, prices, enrollment count)
- List/table view toggle
- Enrollment count per asset from contacts.academic_record
- Existing catalog management preserved as collapsible config section

## Out of Scope
- New database tables or migrations
- Enrollment actions from this page
- New components (all in AcademicCatalog.tsx)

## Dependencies
- S11.3 (vincular academic_record con media_assets) — completed

## Size: L
