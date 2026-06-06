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

---
Task ID: 2
Agent: DataTable Fix Agent
Task: Modify DataTable component to properly render native Stock/Disponibilité/Visibility system

Work Log:
- Added `Zap` icon import from lucide-react for Quick Sell button
- Added `NATIVE_COLUMN_SLUGS` constant and `isNativeColumn()` helper function
- Replaced column sorting logic: native columns now ordered at the BEGINNING in specified order:
  1. `__disponibilite__` (BOOLEAN/Switch) — first after checkbox
  2. `__stock__` (NUMBER/Counter) — second
  3. `__statut__` (STATUS) — third
  Then regular columns follow (old logic only moved BOOLEAN to the end)
- Filtered `__is_visible__` from visibleColumns (handled by Eye icon in # column instead)
- Added Eye/EyeOff visibility toggle in the # column (row number cell):
  - Eye open (emerald) = Published/Visible (`__is_visible__` !== false)
  - Eye closed (muted) = Hidden from public store
  - On click: toggles `__is_visible__` boolean in row data via PUT API call
  - Header # column now shows `#` + small Eye icon indicator
  - Column width increased from w-10 to w-14 to accommodate the icon
- Added ⚡ Quick Sell button (Zap icon) in Stock cell:
  - Amber-colored button next to the + button
  - On click: decrements stock by 1 (same as - button)
  - Business rule: if stock reaches 0 after decrement, automatically sets `__disponibilite__` to 'false'
  - Same business rule also applied to the existing - button
  - Shows toast notifications: "⚡ Vente rapide enregistrée" and "Stock épuisé → Disponible désactivé"
  - Disabled when stock is 0 (visual: muted/cursor-not-allowed)
- Made native columns non-deletable in column options popover:
  - "Supprimer" (Delete) option hidden for native columns (`__statut__`, `__disponibilite__`, `__stock__`)
  - Shows "Colonne système — suppression désactivée" message instead
  - "Éditer" option disabled for native columns with "Type verrouillé" label
  - Added "Native" badge (amber) in popover header for native columns
  - Added "Native" badge (amber) next to column name in the table header
- Disponibilité Switch: existing behavior preserved (always allows on/off toggle, manual override for pre-orders)

Stage Summary:
- Eye/EyeOff toggle in # column for `__is_visible__` visibility control
- Native columns ordered first: Disponibilité → Stock → Statut
- ⚡ Quick Sell button with auto-disponible business rule when stock=0
- Native columns protected: no delete, type change locked, "Native" badge shown
- `__is_visible__` hidden from column list (managed via Eye icon)
- Lint passes cleanly (zero errors)

---
Task ID: 3
Agent: CatalogPreview Fix Agent
Task: Modify CatalogPreview component to respect native Stock/Disponibilité/Visibility system in the public store

Work Log:
- Added `__is_visible__` filter in `filterRows()` function: products with `__is_visible__ === false` are excluded from the public catalogue entirely
- Added `isEpuise` flag derived from `String(rawData.__disponibilite__) === 'false'` in `allProducts` computation
- Modified composite sort: products that are both "Nouveau" AND "Épuisé" no longer get Nouveau sort priority (only truly available Nouveau products sort first)
- Added "Épuisé" badge on product cards (dark/charcoal background with white text, positioned at top-right) when Disponibilité is OFF
- Added "SOLD OUT" diagonal overlay on product card images when Épuisé (semi-transparent black overlay + rotated text ribbon with border)
- Modified Nouveau badge logic: `statut === 'Nouveau' && !isEpuise` — Nouveau badge hidden when product is Épuisé
- Added "Produit épuisé" status indicator pill in product detail view (above CTA button) with dot + label
- Modified WhatsApp/Commander CTA button when Épuisé:
  - Opacity reduced to 50% (`opacity-50`)
  - Click disabled (`pointer-events-none cursor-not-allowed`)
  - Background changed to gray (`grisClair`) with gray text (`grisMoyen`)
  - Text changed to "Produit épuisé"
  - `href`, `target`, `rel` set to undefined when Épuisé (no navigation)
  - `onClick` handler prevents default when Épuisé

Stage Summary:
- Visibility filter: `__is_visible__ === false` products hidden from public catalogue
- Sold Out badge + diagonal "SOLD OUT" overlay on Épuisé product cards
- Nouveau badge suppressed when product is Épuisé
- Commander CTA muted/disabled with "Produit épuisé" text when Disponibilité is OFF
- Composite sort: Épuisé Nouveau products don't get priority over available products
- Lint passes cleanly (zero errors)
- Dev server compiles and serves correctly

---
Task ID: 4
Agent: Main Agent
Task: Deploy complete native Stock/Disponibilité/Visibility system to production

Work Log:
- Committed all changes (sync route, DataTable, CatalogPreview) to git
- Pushed to GitHub: Litbro1517/abaya_collection_catalogue (commit 8178ff0)
- Deployed to Vercel production: abaya-collection-catalogue-9dum.vercel.app
- Verified public store using Agent Browser + VLM:
  - Products show "Épuisé" badge in top-right corner ✓
  - Products show diagonal "SOLD OUT" overlay ✓
  - Product detail shows "Produit épuisé" badge ✓
  - Commander CTA greyed out and disabled ✓
- Verified API: native columns exist (__stock__, __disponibilite__, __statut__) ✓
- Verified row data: __disponibilite__='false', __stock__=0, __is_visible__=True ✓
- Lint passes cleanly (zero errors) ✓
- Dev server compiles without errors ✓

Stage Summary:
- All 3 native columns properly created and visible in database
- Sheet columns named "Disponibilité"/"Stock" are now mapped to native slugs (no duplicates)
- Business rule Stock=0 → Disponibilité=OFF applied during import/sync
- Public store correctly shows Sold Out indicators for all épuisé products
- Deployment live at https://abaya-collection-catalogue-9dum.vercel.app
