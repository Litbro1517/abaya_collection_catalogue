import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';

// ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/gif',
] as const;

const LOCAL_UPLOAD_DIR = 'public/uploads';
const STORAGE_BRANDING_PREFIX = 'branding';

// ━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Strip dangerous characters, collapse underscores, trim leading dots. */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+/, '');
}

/** Generate a collision-resistant filename: base_timestamp_rand.ext */
function uniqueFilename(original: string): string {
  const ext = path.extname(original) || '.png';
  const base = sanitizeFilename(path.basename(original, ext));
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}_${ts}_${rand}${ext}`;
}

// ━━━ Circuit A: Supabase Cloud Storage ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function uploadToSupabase(
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ url: string; filename: string } | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null; // Env vars not configured — skip cloud

  const storagePath = `${STORAGE_BRANDING_PREFIX}/${filename}`;

  try {
    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true, // Overwrite if same path exists — supports logo re-upload
      });

    if (uploadError) {
      console.warn('[Upload:Cloud] Supabase upload failed, falling back to local:', uploadError.message);
      return null; // Trigger fallback
    }

    const { data: urlData } = admin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    if (!urlData?.publicUrl) {
      console.warn('[Upload:Cloud] Public URL resolution failed');
      return null;
    }

    console.log(`[Upload:Cloud] ✓ ${filename} → ${urlData.publicUrl}`);
    return { url: urlData.publicUrl, filename };
  } catch (err) {
    console.warn('[Upload:Cloud] Exception during Supabase upload:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ━━━ Circuit B: Local Filesystem Fallback ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function uploadToLocal(
  filename: string,
  buffer: Buffer,
): Promise<{ url: string; filename: string }> {
  const uploadDir = path.join(process.cwd(), LOCAL_UPLOAD_DIR);

  // Ensure directory exists (recursive for safety)
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, filename);
  await writeFile(filePath, buffer);

  const publicUrl = `/uploads/${filename}`;
  console.log(`[Upload:Local] ✓ ${filename} → ${publicUrl}`);
  return { url: publicUrl, filename };
}

// ━━━ POST /api/upload ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/**
 * Upload endpoint for brand assets (logo, favicon).
 *
 * Strategy: Supabase Cloud → Local Fallback
 *   1. Try Supabase Storage (if env vars configured + bucket accessible)
 *   2. If Supabase fails or is unavailable → write to public/uploads/
 *
 * Response format (strict): { data: { url, filename } }
 */
export async function POST(request: NextRequest) {
  // ── Step 1: Parse FormData ──────────────────────────────────────────
  let file: File | undefined;
  try {
    const formData = await request.formData();
    file = formData.get('file') as File | undefined;
  } catch {
    return NextResponse.json(
      { error: 'Corps de requête invalide — FormData attendu' },
      { status: 400 },
    );
  }

  if (!file) {
    return NextResponse.json(
      { error: 'Aucun fichier fourni — champ "file" requis' },
      { status: 400 },
    );
  }

  // ── Step 2: Validate MIME type ──────────────────────────────────────
  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    return NextResponse.json(
      { error: `Type non supporté: ${file.type}. Acceptés: ${ALLOWED_MIME_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  // ── Step 3: Validate file size ──────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum: 2 Mo` },
      { status: 400 },
    );
  }

  // ── Step 4: Prepare file data ───────────────────────────────────────
  const filename = uniqueFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  // ── Step 5: Circuit A — Supabase Cloud ──────────────────────────────
  const cloudResult = await uploadToSupabase(filename, buffer, file.type);
  if (cloudResult) {
    return NextResponse.json({ data: cloudResult });
  }

  // ── Step 6: Circuit B — Local Fallback ──────────────────────────────
  try {
    const localResult = await uploadToLocal(filename, buffer);
    return NextResponse.json({ data: localResult });
  } catch (err) {
    console.error('[Upload:Local] Critical failure:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'Échec du téléversement — le stockage cloud et local sont indisponibles' },
      { status: 500 },
    );
  }
}
