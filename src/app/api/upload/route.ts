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
 * Multi-mode upload with automatic fallback:
 *
 * 1. Supabase Storage (cloud) — if configured + bucket exists
 * 2. Base64 data URL (inline) — if Supabase not configured, works everywhere including Vercel
 * 3. Local filesystem (dev only) — if no Supabase env vars
 *
 * The base64 fallback makes uploads work immediately on Vercel without any
 * Supabase bucket setup. When Supabase is fully configured later, it
 * automatically switches to cloud storage.
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
        const { supabase, supabaseAdmin, STORAGE_BUCKET } = await import('@/lib/supabase');

        // Prefer admin client (bypasses RLS) if service_role key is available,
        // otherwise use anon client (requires RLS policies to be set up)
        const client = process.env.SUPABASE_SERVICE_ROLE_KEY ? supabaseAdmin : supabase;

        const ext = mimeToExt(file.type, file.name);
        const safeName = `${randomUUID()}${ext}`;
        const storagePath = `branding/${safeName}`;

        const { data, error } = await client.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: true,
          });

        if (!error && data) {
          // Get the public URL
          const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(data.path);

          console.log('[Upload API] ✅ Uploaded to Supabase:', urlData.publicUrl);
          return NextResponse.json({ data: { url: urlData.publicUrl } });
        }

        // If Supabase upload failed, log and fall through to base64
        console.warn('[Upload API] Supabase upload failed, falling back to base64:', error?.message);
      } catch (supabaseErr) {
        console.warn('[Upload API] Supabase error, falling back to base64:', supabaseErr instanceof Error ? supabaseErr.message : String(supabaseErr));
      }
      // Fall through to base64 mode
    }

    // ── MODE 2: Base64 data URL (works everywhere, including Vercel) ──
    // This is the primary fallback for production (Vercel) when Supabase
    // Storage isn't fully configured yet. The image is stored inline as
    // a data URL in the database, which works for small branding assets.
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Check if the data URL is reasonable (should be < ~2.7MB for 2MB file)
    if (dataUrl.length > 3 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large for inline storage. Please configure Supabase Storage for large files.' },
        { status: 400 }
      );
    }

    console.log('[Upload API] ✅ Uploaded as base64 data URL (length:', dataUrl.length, 'chars)');
    return NextResponse.json({ data: { url: dataUrl } });

    // NOTE: Local filesystem mode removed — doesn't work on Vercel (read-only filesystem).
    // Base64 data URLs are the reliable fallback for Vercel deployments.
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
