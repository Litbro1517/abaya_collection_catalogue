# Task 1 - Backend Agent

## Summary
Created the complete backend for the Abaya Collection Catalogue: Prisma schema, API routes, seed data, and utility functions.

## Files Created
- `prisma/schema.prisma` - Full database schema (11 models)
- `prisma/seed.ts` - Default catalog + settings seed
- `src/lib/utils-api.ts` - Slug generation, column type validation
- `src/app/api/datasources/route.ts` - GET list, POST create
- `src/app/api/datasources/[id]/route.ts` - GET, PATCH, DELETE
- `src/app/api/datasources/[id]/columns/route.ts` - GET, POST
- `src/app/api/datasources/[id]/columns/[columnId]/route.ts` - PATCH, DELETE
- `src/app/api/datasources/[id]/rows/route.ts` - GET, POST
- `src/app/api/datasources/[id]/rows/[rowId]/route.ts` - PATCH, DELETE
- `src/app/api/datasources/[id]/rows/batch/route.ts` - PATCH batch
- `src/app/api/datasources/[id]/export/route.ts` - GET CSV export

## Key Decisions
- JSON fields (config, data) stored as strings in SQLite, parsed/stringified in API
- Row PATCH merges new data with existing data (shallow merge)
- Batch row updates use Prisma transactions for atomicity
- STATUS column type uses `__statut__` as slug
- Slug generation handles French accents (à→a, é→e, etc.)
- CSV export includes visible columns only, with proper escaping

## Verification
- `bun run db:push` ✅
- `bun run db:seed` ✅
- `bun run lint` ✅ (no errors)
- Dev server running ✅
