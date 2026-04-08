# S11.3: Retrospective

## Outcome
All acceptance criteria met. media_assets are selectable from a grouped dropdown, auto-filling course fields and computing pricing. Old records without new fields render unchanged.

## What Went Well
- Clean integration: media_assets fetch is independent of existing catalog fetch
- Price logic is straightforward: presale if active, else normal
- Manual fallback preserves full backward compatibility with catalog-based entry

## Metrics
- Files modified: 1 (EditContactDialog.tsx)
- Lines changed: +151 / -35
- Tests: 56/56 passing
- Build: clean (no type errors)

## Decisions
- Used `__manual__` sentinel value for fallback mode instead of a separate toggle
- Price fields only included in record when present (sparse JSONB)
- Thumbnail shown only when linked asset has a URL (graceful degradation)
