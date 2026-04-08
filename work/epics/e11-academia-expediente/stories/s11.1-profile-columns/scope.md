# S11.1: Migration — columnas de perfil + precio en credit_sales

## Objective
Add profile columns to `contacts` and pricing columns to `credit_sales` to support the Expediente del Cliente and Centro Financiero features.

## Changes

### contacts table
- `dieta TEXT` — dietary preference
- `alimentacion TEXT` — feeding style
- `alergias TEXT` — allergies
- `motivo_curso TEXT` — reason for taking the course

### credit_sales table
- `precio_tipo TEXT` — 'preventa' or 'normal'
- `precio_original NUMERIC` — original price before discounts

## Acceptance Criteria
1. Migration applies without error
2. TypeScript types regenerated and include new columns
3. `npm test` passes (56 tests)
4. `npm run build` passes

## Size: S
