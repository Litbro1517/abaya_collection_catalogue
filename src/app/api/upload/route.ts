import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Allowed MIME types
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/gif',
]);

// Max file size: 2 MB
const MAX_SIZE = 2 * 1024 * 1024;

/**
 * Dual-mode upload: Supabase Storage (cloud) or local filesystem (fallback).
 *
 * - If SUPABASE_URL + SUPABASE_ANON_KEY are set → uploads to Supabase (Vercel-compatible)
 * - Otherwise → saves to public/uploads/ (local dev, read-only on Vercel)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 2 MB)' }, { status: 400 });
    }

    // Generate a unique filename
    const ext = mimeToExt(file.type, file.name);
    const safeName = `${randomUUID()}${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── MODE 1: Supabase Storage (cloud, Vercel-compatible) ──
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const isSupabaseConfigured =
      supabaseUrl &&
      supabaseKey &&
      supabaseUrl !== 'https://your-project.supabase.co' &&
      supabaseKey !== 'your-anon-key-here';

    if (isSupabaseConfigured) {
      try {
        const { supabaseAdmin, STORAGE_BUCKET } = await import('@/lib/supabase');

        const storagePath = `branding/${safeName}`;
        const { data, error } = await supabaseAdmin.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: true,
          });

        if (error) {
          console.error('[Upload API] Supabase upload error:', error);
          return NextResponse.json(
            { error: `Storage upload failed: ${error.message}` },
            { status: 500 }
          );
        }

        // Get the public URL (using public client is fine for reading URLs)
        const { supabase } = await import('@/lib/supabase');
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(data.path);

        console.log('[Upload API] ✅ Uploaded to Supabase:', urlData.publicUrl);
        return NextResponse.json({ data: { url: urlData.publicUrl } });
      } catch (supabaseErr) {
        console.error('[Upload API] Supabase import/upload error:', supabaseErr);
        return NextResponse.json(
          { error: 'Cloud storage upload failed. Check Supabase configuration.' },
          { status: 500 }
        );
      }
    }

    // ── MODE 2: Local filesystem (dev / fallback) ──
    try {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadsDir, { recursive: true });

      const filePath = path.join(uploadsDir, safeName);
      await writeFile(filePath, buffer);

      const url = `/uploads/${safeName}`;
      console.log('[Upload API] ✅ Uploaded locally:', url);
      return NextResponse.json({ data: { url } });
    } catch (fsErr) {
      console.error('[Upload API] Local filesystem error:', fsErr);
      return NextResponse.json(
        { error: 'Local storage unavailable. Configure Supabase for cloud deployment.' },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error('[Upload API] Error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

/**
 * Map MIME type to file extension, preserving original extension if available
 */
function mimeToExt(mime: string, originalName: string): string {
  // Prefer the original extension if present
  const originalExt = originalName.includes('.')
    ? originalName.slice(originalName.lastIndexOf('.'))
    : '';

  if (originalExt) return originalExt;

  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/x-icon': '.ico',
    'image/vnd.microsoft.icon': '.ico',
    'image/gif': '.gif',
  };
  return map[mime] || '.bin';
}
