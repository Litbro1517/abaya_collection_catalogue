---
Task ID: 1
Agent: Main Agent
Task: Implement Delta Synchronization Engine & Automatic Initialization for "Importer une feuille" button

Work Log:
- Audited current codebase: DataPillar.tsx, DataTable.tsx, GoogleConnectPanel.tsx, sync API route
- Discovered the root cause: `/api/google/sync` was doing DESTRUCTIVE full replacement (delete all rows/columns, recreate) instead of delta sync
- Rewrote `/api/google/sync/route.ts` with dual-branch logic (full import vs delta sync)
- Delta sync engine with auto-initialization and diagnostic logging implemented

Stage Summary:
- Delta Sync Engine fully implemented in backend API
- Auto-initialization defaults: Statut="Courant", Disponibilité=Épuisé (OFF), Visibilité=Visible 👁️
- Lint passes cleanly

---
Task ID: 2
Agent: Main Agent
Task: Reorganize sync to "Table par Table" system with per-table RefreshCw buttons and "N ordre" as primary identifier

Work Log:
- Analyzed user's screenshot showing the Google Connect Panel and data source list
- Changed GoogleConnectPanel icon from RefreshCw to Link2 (connection only, opens GoogleSheetsBrowser)
- Removed delta sync logic from GoogleConnectPanel (now purely for Google account connection)
- Added per-table RefreshCw sync button in DataPillar.tsx next to each imported table
  - Button appears on hover (opacity-0 → group-hover:opacity-100)
  - Gold (#C9A84C) color when linked to Google Sheet
  - Shows Loader2 spinner when that specific table is syncing
  - Uses e.stopPropagation() to prevent table selection when clicking sync
  - Disabled during any sync to prevent double-clicks
- Added `syncingTableId` state to track which table is syncing (per-table spinner)
- Replaced `handleSyncGoogleSheet()` with `handleSyncTable(dsId, sheetId, dsName)` — accepts explicit table params
- Updated dropdown "Synchroniser" menu item to use `handleSyncTableClick`
- Updated API route.ts: Changed PRIMARY identifier from "#" to "N ordre"
  - PRIMARY search: "N ordre", "N°", "nordre" in both DB columns and sheet headers
  - FALLBACK search: "#" if "N ordre" not found
  - Updated diagnostic logs to show "N ordre" as the identifier column
  - Added "TABLE PAR TABLE" label in diagnostic logs
- Strict table isolation guaranteed: API only queries rows/columns for the specified dataSourceId

Stage Summary:
- GoogleConnectPanel: Link2 icon (connection only), no RefreshCw
- DataPillar: Per-table RefreshCw button with gold color, per-table spinner
- API: "N ordre" as PRIMARY identifier, "#" as fallback
- Table isolation: Each sync is scoped to a single dataSourceId
- Lint passes cleanly (zero errors)
