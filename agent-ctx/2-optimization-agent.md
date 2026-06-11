# Task ID: 2 — Centralize colormap loading

## Agent: Optimization Agent

## Mission
Eliminate per-cell fetch in ColorCell.tsx by loading colormap ONCE in DataPillar and passing through props.

## Changes Made

### 1. DataPillar.tsx
- Added `import { buildColorLookupMap } from '@/lib/color-utils'`
- Added `ColormapItem` type alias + `colormapItems` state + single fetch useEffect
- Passed `colormapItems={colormapItems}` to `<DataTable>`

### 2. DataTable.tsx
- Added `colormapItems` optional prop to `Props` interface
- Added `colormapItems` to component destructuring
- Passed `colormapItems={colormapItems}` to `<ColorCell>`

### 3. ColorCell.tsx
- Added `colormapItems` optional prop to `ColorCellProps` interface
- Added `colormapItems` to destructuring
- Replaced individual fetch useEffect with prop-based logic (fallback to fetch if no prop)

## Verification
- `bun run lint` — passed clean (0 errors, 0 warnings)

## Performance Impact
- Before: 200 ColorCell instances × 1 fetch each = 200 HTTP requests to /api/colormap
- After: 1 fetch in DataPillar, shared via props = 1 HTTP request
