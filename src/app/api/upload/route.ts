import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Constants ──────────────────────────────────────────────
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/gif',
];
const LOCAL_UPLOAD_DIR = 'public/uploads';
const STORAGE_BUCKET = 'assets';

// ── Lazy Supabase client (avoids crash when env vars are absent) ──
let _supabaseAdmin: SupabaseClient | null = null;
let _supabaseChecked = false;

function getSupabaseAdmin(): SupabaseClient | null {
  if (_supabaseChecked) return _supabaseAdmin;
  _supabaseChecked = true;

  const url = process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';

  if (!url || !anonKey) return null;

  try {
    _supabaseAdmin = createClient(url, serviceKey || anonKey);
  } catch {
    _supabaseAdmin = null;
  }
  return _supabaseAdmin;
}

// ── Helpers ────────────────────────────────────────────────
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[._-]+/, '');
}

function uniqueFilename(original: string): string {
  const ext = path.extname(original) || '.png';
  const base = sanitizeFilename(path.basename(original, ext));
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}_${ts}_${rand}${ext}`;
}

// ── POST /api/upload ──────────────────────────────────────
export async function POST(request: NextRequest) {
  // 1. Parse FormData
  let file: File | undefined;
  try {
    const formData = await request.formData();
    file = formData.get('file') as File | undefined;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  if (!file) {
    return NextResponse.json(
      { error: 'No file provided' },
      { status: 400 }
    );
  }

  // 2. Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  // 3. Validate file size (≤ 2 MB)
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum: 2 MB` },
      { status: 400 }
    );
  }

  const filename = uniqueFilename(file.name);
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // 4. Branch A — Supabase Storage (if env vars are configured)
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      const storagePath = `branding/${filename}`;
      const { error: uploadError } = await admin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (!uploadError) {
        const { data: urlData } = admin.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(storagePath);

        return NextResponse.json({
          data: {
            url: urlData.publicUrl,
            filename,
          },
        });
      }
      // Supabase upload failed (RLS, bucket missing, etc.) → fall through to local
    } catch {
      // Supabase client error → fall through to local fallback
    }
  }

  // 5. Branch B — Local filesystem fallback
  try {
    const uploadDir = path.join(process.cwd(), LOCAL_UPLOAD_DIR);
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, fileBuffer);

    const publicUrl = `/uploads/${filename}`;

    return NextResponse.json({
      data: {
        url: publicUrl,
        filename,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Upload failed: could not save file' },
      { status: 500 }
    );
  }
}
