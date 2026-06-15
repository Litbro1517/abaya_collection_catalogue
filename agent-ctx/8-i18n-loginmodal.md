# Task 8 — Internationalize LoginModal.tsx & fix remaining hardcoded strings

## Summary
Completed full internationalization of LoginModal.tsx and gallery/Header.tsx by replacing all hardcoded French strings with `t()` translation calls. Added 28 new translation keys (21 for login, 7 for header) across all 3 locales (fr, en, ar).

## Files Modified
1. `/home/z/my-project/src/components/LoginModal.tsx` — Replaced 21 hardcoded French strings with `t('login.*')` calls
2. `/home/z/my-project/src/lib/i18n/dictionaries.ts` — Added `login.*` (21 keys) and `header.*` (7 keys) to fr, en, ar
3. `/home/z/my-project/src/components/gallery/Header.tsx` — Replaced 7 hardcoded French strings with `t('header.*')` calls

## Files Verified (No Changes Needed)
- `/home/z/my-project/src/app/layout.tsx` — Left as-is (server-side SEO metadata)
- `/home/z/my-project/src/components/preview/SocialStickyTickets.tsx` — Already i18n'd
- `/home/z/my-project/src/components/preview/CodForm.tsx` — Already i18n'd

## Verification
- `bun run lint` passes with zero errors
