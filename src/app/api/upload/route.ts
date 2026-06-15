import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
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

    // Ensure the uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    // Generate a unique filename to prevent collisions and path traversal
    const ext = path.extname(file.name) || mimeToExt(file.type);
    const safeName = `${randomUUID()}${ext}`;

    // Write the file
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadsDir, safeName);
    await writeFile(filePath, buffer);

    // Return the public URL
    const url = `/uploads/${safeName}`;
    return NextResponse.json({ data: { url } });
  } catch (err) {
    console.error('[Upload API] Error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

/**
 * Map MIME type to file extension when the original filename has none
 */
function mimeToExt(mime: string): string {
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
