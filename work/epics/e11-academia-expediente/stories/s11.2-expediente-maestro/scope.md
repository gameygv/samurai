# S11.2: Expediente Maestro — 3 Tabs

## Objective

Redesign EditContactDialog into "Expediente Maestro del Cliente" with 3 organized tabs: Datos Base, Ficha Curricular, and Notas del Perfil. Integrates the 4 new profile columns from S11.1 (dieta, alimentacion, alergias, motivo_curso) into the dialog.

## In Scope

- Tab 1 "Datos Base": nombre, apellido, telefono, email, ciudad, estado, C.P., grupo de campana, etiquetas (reorganized with section headers)
- Tab 2 "Ficha Curricular": academic_record list with add/remove, shows course, date, location, teacher, nivel. Attendance checkbox per entry
- Tab 3 "Notas del Perfil": dieta, alimentacion, alergias, motivo_curso (NEW fields) + internal_notes (existing)
- Dialog title: "Expediente Maestro del Cliente" with descriptive subtitle
- Save all new fields to contacts table on submit
- Backward compatibility with existing academic_record JSONB format

## Out of Scope

- asset_id linking to media_assets (S11.3)
- Price tracking / precio_dado (S11.3)
- Advanced filters on contacts directory (S11.6)
- New database migrations (columns already exist from S11.1)

## Acceptance Criteria

1. Dialog title shows "Expediente Maestro del Cliente" with subtitle
2. 3 tabs visible: Datos Base, Ficha Curricular, Notas del Perfil
3. Tab 1 shows all personal data + location + group + tags with section headers
4. Tab 2 shows academic record with add course form and attendance toggle
5. Tab 3 shows dieta, alimentacion, alergias, motivo_curso fields + internal notes
6. All data saves correctly to contacts table (including new profile fields)
7. Existing data loads correctly (backward compat with old academic_record format)
8. npm test + npm run build pass

## Dependencies

- S11.1 (profile columns migration) — DONE
