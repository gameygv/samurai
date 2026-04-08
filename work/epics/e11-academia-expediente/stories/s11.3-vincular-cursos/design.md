# S11.3: Design

## Data Flow
1. On dialog open, fetch media_assets: `supabase.from('media_assets').select(...)` where category != PAYMENT
2. Select dropdown grouped by category, with "Otro (manual)" fallback
3. On select: auto-fill course, nivel, profesor, sede, compute precio_dado + tipo_precio
4. On save: academic_record entry includes { asset_id, precio_dado, tipo_precio }

## academic_record Entry Shape (extended)
```json
{
  "id": "string",
  "course": "string",
  "date": "string",
  "location": "string",
  "teacher": "string",
  "nivel": "string",
  "attendance": false,
  "asset_id": "uuid | null",
  "precio_dado": "number | null",
  "tipo_precio": "'preventa' | 'normal' | null"
}
```

## Price Logic
- If asset has presale_ends_at and it's in the future: default to presale_price, tipo = 'preventa'
- Otherwise: default to normal_price, tipo = 'normal'
- Agent can override precio_dado manually

## UI Changes (EditContactDialog.tsx only)
- New state: mediaAssets array, fetched in useEffect
- Course dropdown: shows media_assets grouped by category + "Otro (manual)"
- When asset selected: auto-fill location, teacher, nivel from asset
- New field: precio_dado (numeric input)
- Display in history: thumbnail + price badge + tipo badge
