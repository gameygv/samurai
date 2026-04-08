# S11.4 Retrospective

## Outcome: DONE

## What was delivered
- "Por Liquidar" column added to Bóvedas de Crédito table (between PAGADO and ESTADO GENERAL)
- Calculation: `max(0, total_amount - down_payment - sum(PAID installments))`
- Color coding: emerald when $0, amber when balance > 0
- precio_tipo badge shown in client column (PREVENTA amber, NORMAL slate)
- colSpan updated for loading/empty states

## What went well
- S11.1 migration already created precio_tipo and precio_original columns — no schema changes needed
- Existing code already calculated totalPaid, porLiquidar was trivial to derive
- Clean separation: display-only changes, no business logic modified

## Decisions
- ManageCreditDialog create flow not modified — precio_tipo population is a separate concern (already available via S11.1 columns)
- Badge uses same styling patterns as existing status badges for consistency

## Files modified
- src/pages/Payments.tsx (23 lines added, 3 changed)

## Verification
- TypeScript: pass (tsc --noEmit)
- Build: pass (vite build in 17.74s)
