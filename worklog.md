---
Task ID: 1
Agent: Main Agent
Task: Industrialisation du Design System — Active Theme Engine

Work Log:
- Created theme.config.ts with 4 pivots (primaryColor, secondaryColor, accentColor, backgroundColor) + 3 exceptions (brandGreenColor, destructiveColor, borderColor) + derivation engine computing 85+ CSS variables
- Added 3 exception fields to Prisma CatalogSettings schema (brandGreenColor, destructiveColor, borderColor)
- Generated Prisma client with `npx prisma generate`
- Created ThemeProvider component that reads settings from DB, computes derived variables, and injects into :root
- Created ThemeInjector client component that bridges server layout with ThemeProvider
- Updated layout.tsx to include ThemeInjector
- Updated API route /api/catalog/settings to handle 3 new exception fields
- Redesigned SettingsPillar Style tab with:
  - Palette Officielle (4 pivot colors with reference circles, hex input, reset button, live preview)
  - Couleurs Avancées (3 exception colors with same UI pattern)
  - Aperçu en Temps Réel (live preview panel showing buttons, badges, text, cards with current colors)
  - Typographie & CSS section
- Migrated globals.css:
  - Replaced ~24 hardcoded hex/rgba values with CSS variable references
  - Added ~120 derived CSS variable definitions to :root as fallbacks
- Migrated #C9A84C (brand gold) across 15+ components:
  - DataTable.tsx: ~17 instances → text-gold, bg-gold, border-gold, ring-gold
  - DataPillar.tsx: ~45 instances → gold Tailwind tokens
  - ColumnEditorDialog.tsx: ~27 instances → gold tokens + bg-primary for selected type
  - ColumnVisibilityDropdown.tsx: ~7 instances → gold tokens
  - StockSourceModal.tsx: 2 instances → gold + var(--primary)
  - GoogleConnectPanel.tsx: 1 instance → hover:text-gold
  - CatalogPreview.tsx: ~26 BRAND inline style refs → var(--primary), var(--foreground), etc.
  - ProductPage.tsx: ~20 BRAND inline style refs → CSS variables
  - AdminDashboard.tsx: gradient + BRAND constant updated
  - RelationManager.tsx: 1 inline style → var(--gold)
- Also migrated status colors in DataTable:
  - text-emerald-600/700 → text-[var(--dt-stock-ok-text)]
  - text-amber-600 → text-[var(--dt-stock-low-text)]
  - text-red-500 → text-destructive
  - bg-amber-50 → bg-[var(--dt-pending-row-bg)]
- Committed and pushed to main branch for Vercel deployment

Stage Summary:
- Active Theme Engine fully operational with 4 pivots + 3 exceptions driving 85+ derived CSS variables
- ThemeProvider injects computed variables into :root on every page load
- Style panel redesigned with Palette Officielle, Couleurs Avancées, and Live Preview
- ~80+ hardcoded #C9A84C instances replaced with CSS variable references across 15+ components
- BRAND inline style references replaced with var() references in CatalogPreview and ProductPage
- All CSS variables verified in browser via getComputedStyle
- Push deployed: ab0015e → main (Vercel build triggered)
