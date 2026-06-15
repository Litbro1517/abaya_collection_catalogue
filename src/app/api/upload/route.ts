import { NextRequest, NextResponse } from 'next/server';
import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import { randomUUID } from 'crypto';

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

export async function POST(request: NextRequest) {
  try {
    // ── Validate Supabase configuration ──
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('[Upload API] Supabase not configured — missing SUPABASE_URL or SUPABASE_ANON_KEY');
      return NextResponse.json(
        { error: 'Storage not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY.' },
        { status: 503 }
      );
    }

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
    const safeName = `branding/${randomUUID()}${ext}`;

    // Convert to buffer for Supabase upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(safeName, buffer, {
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

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    const publicUrl = urlData.publicUrl;

    return NextResponse.json({ data: { url: publicUrl } });
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
