---
Task ID: 1
Agent: Main Agent
Task: Implement Optimistic Updates + Background Sync + Rollback for DataTable

Work Log:
- Read DataTable.tsx, DataPillar.tsx, CatalogPreview.tsx, and API routes
- Identified root cause: every Switch/Eye click calls `await fetch()` + `onRefresh()`, and `onRefresh()` triggers `loadDataSourceData()` which calls `setLoading(true)`, replacing the table with a loading spinner (white page freeze)
- Added `onUpdateRow` prop to DataTable interface
- Added `optimisticSwitch` and `optimisticVisibility` state maps in DataTable
- Created `backgroundSave()` utility: instant optimistic update + async background API call + rollback on failure
- Rewrote Switch (BOOLEAN) handler: instant `setOptimisticSwitch` + `backgroundSave()` (no await, no onRefresh)
- Rewrote Eye (Visibility) handler: instant `setOptimisticVisibility` + `backgroundSave()` (no await, no onRefresh)
- Updated Stock debounce timer: uses `onUpdateRow` instead of `onRefresh()` (no loading spinner)
- Updated `saveCell()`: uses `onUpdateRow` instead of `onRefresh()`
- Added `handleUpdateRow` in DataPillar: uses `useAppStore.getState().rows` for stale-closure safety
- Passed `onUpdateRow={handleUpdateRow}` to DataTable in DataPillar
- Fixed TypeScript error: `setRows` takes `Row[]` not a callback function
- Added `isVisible` computed value using optimistic overlay in row rendering
- Verified lint passes and app compiles with HTTP 200

Stage Summary:
- Three optimistic state layers: Stock (debounced 1.5s), Switch (instant), Visibility (instant)
- All three use background API save with rollback on failure + toast notification
- No more `onRefresh()` calls from these handlers → no loading spinner → no freeze
- `handleUpdateRow` silently updates zustand store rows without full reload
- App compiles and renders correctly
