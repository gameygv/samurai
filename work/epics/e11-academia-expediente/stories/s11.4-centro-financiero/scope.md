# S11.4: Centro Financiero — "Por Liquidar" + Precio Dado

## Objective
Add "Por Liquidar" column to Bóvedas de Crédito table and show precio_tipo badge per credit sale.

## In Scope
- Calculate and display "Por Liquidar" (total_amount - down_payment - sum PAID installments)
- Color coding: green if $0, amber if > 0
- Show precio_tipo badge (PREVENTA amber, NORMAL slate) in client column
- Verify ManageCreditDialog create flow for precio_tipo/precio_original

## Out of Scope
- Modifying credit creation flow (display-only story)
- Changes to ManageCreditDialog business logic

## Files
- src/pages/Payments.tsx (main changes)
- src/components/payments/ManageCreditDialog.tsx (review only)

## Done Criteria
1. "Por Liquidar" column visible between PAGADO and ESTADO GENERAL
2. Correct calculation: total_amount - down_payment - sum(PAID installments)
3. precio_tipo badge shown when data exists
4. npm test + build pass
