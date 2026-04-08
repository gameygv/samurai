# S11.7 Retrospective

## What was delivered
- AcademicCatalog.tsx rewritten from 168 to ~430 lines
- Grid view with course cards showing poster, title, nivel/profesor/sede badges, prices (presale highlighted in amber), enrollment counts, friday concert badges
- List view with table layout and the same data columns
- Filter bar with 5 dropdowns: profesor, sede, nivel, tipo/category, mes (derived from valid_until/presale_ends_at)
- Enrollment count computed from contacts.academic_record asset_id references
- Existing catalog config management preserved in collapsible "Gestionar Catalogos" section
- Grid/list toggle button in header

## Quality gates
- TypeScript: clean (0 errors)
- Tests: 56/56 passed
- Build: success (vite production build)

## What went well
- MediaManager provided a clear pattern for card rendering and dark theme styling
- Parallel data fetching with Promise.all keeps load time minimal
- useMemo for enrollment map and filter options avoids unnecessary recomputation

## Decisions
- Kept all code in AcademicCatalog.tsx (no new components) per story scope
- Used __all__ sentinel value for "no filter" since Select requires a value
- Derived filter options from actual data rather than hardcoded lists
- Presale price shown in amber only when presale is still active (date check)
