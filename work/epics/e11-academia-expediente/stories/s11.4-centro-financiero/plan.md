# S11.4: Implementation Plan

## Tasks

### T1: Add "Por Liquidar" column to table header
- Insert `<TableHead>POR LIQUIDAR</TableHead>` between PAGADO and ESTADO GENERAL
- Update colSpan for loading/empty rows (5 → 6)

### T2: Calculate and display "Por Liquidar" per row
- Compute: `porLiquidar = max(0, totalAmount - totalPaid)`
- Display formatted currency
- Green text if 0, amber if > 0

### T3: Add precio_tipo badge in client column
- If `sale.precio_tipo` exists, show badge after concept text
- PREVENTA → amber badge, NORMAL → slate badge

### T4: Verify + build
- npm test
- npm run build
