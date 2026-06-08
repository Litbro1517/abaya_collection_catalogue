---
Task ID: 1
Agent: Main
Task: Add Category & SubCategory models to Prisma schema

Work Log:
- Added Category model (slug unique, label, visible, ordre) to prisma/schema.prisma
- Added SubCategory model (slug unique, label, categoryId FK, visible, ordre)
- Changed datasource from postgresql to sqlite (matching existing .env)
- Ran bun run db:push successfully — tables created

Stage Summary:
- Two new tables: categories, sub_categories
- Slug-first architecture: slug is immutable identifier, label is renameable
- Zero-product deletion constraint enforced via API, not DB level
---
Task ID: 2
Agent: Subagent (full-stack-developer)
Task: Create API routes for Category & SubCategory CRUD

Work Log:
- Rewrote /src/app/api/categories/route.ts with GET/POST/PATCH/DELETE
- Created /src/app/api/subcategories/route.ts with GET/POST/PATCH/DELETE
- Both DELETE endpoints enforce zero-product constraint (scan all Row data)
- Seeded 5 categories (Ensemble, Abaya, Kimono, Robe, Accessoires) with 3 subcategories each

Stage Summary:
- Full CRUD API for categories and subcategories
- Slugs auto-generated from labels (accent-stripped)
- Product count check before deletion
---
Task ID: 3
Agent: Subagent (full-stack-developer)
Task: Add __category__ and __sub_category__ native columns to sync/import flow

Work Log:
- Updated sync route to add __category__ (TEXT, order -4) and __sub_category__ (TEXT, order -5)
- Maps sheet columns "Catégorie"/"Categorie"/"Category" to __category__
- Maps sheet columns "Sous-catégorie"/"Sous-categorie"/"SubCategory" to __sub_category__
- Preserves values on re-import alongside stock/disponibilite/statut
- Updated DataTable NATIVE_COLUMN_SLUGS and NATIVE_ORDER

Stage Summary:
- Categories flow through import pipeline natively
- Dual ingestion: Google Sheets import + manual admin entry
---
Task ID: 4
Agent: Subagent (full-stack-developer)
Task: Build admin Catalogue management panel in Settings

Work Log:
- Added 'catalogue' to SettingsTab type in types/index.ts
- Added 6th tab "Catalogue" with BookOpen icon to SettingsPillar
- Slot 1: Grandes Catégories (Niveau 1) — list with inline editing, visibility switch, product count, delete with zero-product check
- Slot 2: Sous-catégories (Niveau 2) — select parent, same features
- Brand gold #C9A84C used for accents

Stage Summary:
- Complete admin control panel for managing two-level filters
- Inline label editing, visibility toggle, safe deletion
---
Task ID: 5
Agent: Main
Task: Implement two-level pill filter UI in CatalogPreview

Work Log:
- Added activeMacroFilter and activeMicroFilter state
- Added dynamicCategories state fetched from /api/categories
- Added getCategoryProductCounts() and getSubCategoryProductCounts()
- Updated filterRows() to use __category__ and __sub_category__ fields
- Replaced single-level filter bar with two-level pill system:
  - Level 1: Green pills (secondaryColor) for macro categories with product counts
  - Level 2: Gold pills (BRAND.dore) for micro sub-filters, only when macro selected
- Added contextual category title (h2 with Playfair Display font)
- Kept legacy filter as fallback when no dynamic categories loaded

Stage Summary:
- Two-level dynamic filtering fully implemented
- Level 1 pills: Tout + visible categories with counts
- Level 2 pills: Tous + visible subcategories with counts (contextual)
- Context title appears when category selected
---
Task ID: 6
Agent: Subagent (full-stack-developer)
Task: Fix stock/disponibilité persistence + event handler bugs

Work Log:
- Fixed race condition: debounced stock save overwrites switch change (Sur commande)
- Added pending debounce sync in switch handler
- Fixed keyboard "0" vs arrow "0" divergence in saveCell
- Added cleanup for optimistic state on text-edit save
- Added __category__ and __sub_category__ to native column handling

Stage Summary:
- Switch changes now persist correctly (Sur commande survives refresh)
- Keyboard and arrow input behave identically
- Debounced saves respect concurrent switch toggles
