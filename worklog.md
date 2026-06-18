---
Task ID: 1
Agent: Main Agent (Staff Software Engineer)
Task: Create src/app/api/upload/route.ts — hybrid Supabase + local fallback upload route

Work Log:
- Diagnosed root cause: route `/api/upload` missing → 404 → "Erreur lors du téléversement"
- Identified critical secondary bug: `import { supabaseAdmin } from '@/lib/supabase'` crashes at module load when SUPABASE_URL is empty (createClient('') throws "supabaseUrl is required")
- Designed lazy initialization pattern: `getSupabaseAdmin()` creates client only when env vars are present
- Created `src/app/api/upload/route.ts` with full implementation:
  - MIME validation: 7 allowed types (png, jpeg, webp, svg+xml, x-icon, vnd.microsoft.icon, gif)
  - Size validation: ≤ 2 MB
  - Branch A: Supabase Storage upload to `assets/branding/` when env vars present
  - Branch B: Local fallback to `public/uploads/` when Supabase unavailable or upload fails
  - Response format: strict `{ data: { url, filename } }`
  - Filename sanitization + unique timestamp+random suffix
- Restored node_modules via `bun install` (multiple retries due to timeouts)
- Runtime tested with curl:
  - ✅ SVG upload → 200 + `{ data: { url: "/uploads/logo_xxx.svg", filename: "logo_xxx.svg" } }`
  - ✅ No file → 400 + `{ error: "Invalid request body" }`
  - ✅ 3MB file → 400 + `{ error: "File too large (3.0 MB). Maximum: 2 MB" }`
  - ✅ text/plain → 400 + `{ error: "Invalid file type: text/plain..." }`
  - ✅ Uploaded file verified on disk at `public/uploads/logo_1781796217580_vctey3.svg`
- Lint: 0 errors on upload route
- Synchronized PROJECT_MAP.md (TECH_STACK, SYSTEM_FLOW Flux 5, ARCHITECTURE, ORPHANS_AND_PENDING, VERIFIABLE_GOALS VG8, MILESTONES P6)

Stage Summary:
- Route `/api/upload` created and fully functional
- Key design decision: lazy Supabase client initialization to prevent crash when env vars are absent
- All 4 runtime tests pass (valid upload, no file, oversized, invalid MIME)
- PROJECT_MAP.md synchronized with new route documentation

---
Task ID: P2
Agent: Main Agent (Staff Software Engineer)
Task: Fix category translation — labels not switching when user changes language

Work Log:
- Diagnosed the issue: footer Col 3 "Catalog Navigation" used `{cat.label}` instead of `{resolveT(cat.translations, cat.label)}`
- CatalogPreview.tsx line 1662: single-line fix applied
- Discovered secondary issue: production DB (PostgreSQL) had no translations in Category/SubCategory records
- Updated all 6 categories via PATCH /api/categories with fr/en/ar translations
- Discovered PATCH /api/subcategories didn't support `translations` field — added support
- Updated all 18 subcategories via PATCH /api/subcategories with fr/en/ar translations
- Verified on production: EN shows Set/Dress/Accessories, AR shows طقم/فستان/إكسسوارات
- Both filter bar AND footer now translate correctly

Stage Summary:
- 2 code files modified: CatalogPreview.tsx (1 line) + subcategories/route.ts (2 lines)
- Production DB seeded with translations for 6 categories + 18 subcategories
- All 3 locales (FR/EN/AR) verified working on production
