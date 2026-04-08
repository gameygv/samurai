# S11.3: Vincular academic_record con media_assets

## Objective
Enhance the "Registrar Nuevo Curso" form in Tab 2 (Ficha Curricular) to link courses with media_assets, auto-fill fields, and track pricing.

## In Scope
- Dropdown of active media_assets (non-PAYMENT, not expired) replacing plain course catalog
- Auto-fill: course name, nivel, profesor, sede from selected asset
- Pricing: asset_id, precio_dado, tipo_precio stored per academic_record entry
- Display: thumbnail, price badge, price type badge in course history
- Backward compatibility: old records without new fields render correctly
- Manual fallback: "Otro (manual)" option for courses not in Media Manager

## Out of Scope
- Database schema changes (JSONB is sufficient)
- Enrollment from Media Manager side
- Payment processing

## Done Criteria
1. Agent can select a media_asset from dropdown and fields auto-fill
2. precio_dado defaults correctly based on presale status
3. Old records without asset_id/precio_dado display unchanged
4. npm test + build pass
