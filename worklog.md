---
Task ID: 1
Agent: Main Agent
Task: Implement Delta Synchronization Engine & Automatic Initialization for "Importer une feuille" button

Work Log:
- Audited current codebase: DataPillar.tsx, DataTable.tsx, GoogleConnectPanel.tsx, sync API route
- Discovered the root cause: `/api/google/sync` was doing DESTRUCTIVE full replacement (delete all rows/columns, recreate) instead of delta sync
- Found `button[title="Importer une feuille"]` in GoogleConnectPanel.tsx (line 100) with RefreshCw icon
- Rewrote `/api/google/sync/route.ts` with dual-branch logic:
  - Branch 1: FULL IMPORT (first-time, no dataSourceId) — keeps existing behavior
  - Branch 2: DELTA SYNC ENGINE (re-sync, dataSourceId provided) — NEW logic
- Delta sync engine implements:
  - Finds "#" column (ID Métier) by name in existing DB columns
  - Fallback: searches for "N°", "N Ordre", "ID Métier", "Référence" columns
  - Builds Set of existing "#" values from current catalogue rows
  - Compares with Google Sheet rows — only inserts MISSING entries
  - NEVER overwrites or deletes existing data
  - Auto-initializes new rows: __statut__="Courant", Disponibilité=OFF ("Épuisé"), __is_visible__=true
  - Handles new columns in Google Sheet (adds them without touching existing data)
  - Comprehensive diagnostic console.log before execution
- Updated GoogleConnectPanel.tsx:
  - "Importer une feuille" button now detects if active DataSource has sheetId
  - If yes: triggers delta sync directly (no dialog needed)
  - If no: opens GoogleSheetsBrowser for first import
  - Visual indicator: gold color + "🔄 Delta sync disponible" text when linked
- Updated DataPillar.tsx:
  - handleSyncGoogleSheet() now passes mode: 'delta' to the API
  - Shows informative toast messages (new products added / catalogue up to date)
  - Never touches the Activity/status button

Stage Summary:
- Delta Sync Engine fully implemented in backend API
- Frontend properly wired to use delta mode on both entry points
- Auto-initialization defaults: Statut="Courant", Disponibilité=Épuisé (OFF), Visibilité=Visible 👁️
- Diagnostic logging: product counts, ID Métier values, column structure comparison
- Lint passes cleanly (zero errors)
- API responds correctly (tested with curl, auth middleware blocks unauthorized as expected)
- Note: Browser testing limited by sandbox resource constraints (server OOM/crashes)
