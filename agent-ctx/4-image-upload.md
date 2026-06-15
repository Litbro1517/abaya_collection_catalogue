# Task 4 — Image Upload Widget + API Route

## Status: Completed

## Changes Made

### Part A: API Route `/api/upload/route.ts`
- POST handler for file uploads
- MIME type validation (png, jpeg, webp, svg+xml, x-icon, vnd.microsoft.icon)
- 2MB max file size
- Writes to `public/uploads/` with timestamp-prefixed unique filename
- Returns `{ data: { url, filename } }`

### Part B: `ImageUpload` Component
- `src/components/ui/image-upload.tsx`
- Drag-and-drop + click-to-upload
- Client-side validation matching server
- Preview mode when value exists, with remove button
- Loading spinner during upload
- Error display for type/size/upload failures
- Uses i18n translations from existing dictionaries

### Part C: `SettingsPillar.tsx` Updated
- Logo section: replaced Input + manual preview with `<ImageUpload>`
- Favicon section: same, with restricted `accept` for icon types
- `Input` import kept (used elsewhere)

## Lint: Zero errors on changed files
