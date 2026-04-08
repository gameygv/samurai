# S11.3: Plan

## Tasks

### T1: Fetch media_assets on dialog open
- Add mediaAssets state
- Add useEffect to fetch non-PAYMENT, non-expired assets
- Add newCourse fields: asset_id, precio_dado, tipo_precio

### T2: Replace course dropdown with media_assets selector
- Grouped by category with "Otro (manual)" fallback
- On select: auto-fill course, nivel, profesor, sede, compute price defaults
- On "Otro (manual)": revert to original catalog dropdown behavior

### T3: Add precio_dado input field
- Numeric input, defaults from asset price logic
- tipo_precio auto-calculated display

### T4: Enhance course history display
- Thumbnail from asset URL
- Price + tipo_precio badges
- Backward compatible with old records

### T5: Verify build + tests pass
