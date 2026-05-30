import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ data: null, error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const ext = path.extname(file.name) || '.png';
    const filename = `${uuidv4()}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Resize image to max 1200px width, maintain aspect ratio
    await sharp(buffer)
      .resize(1200, null, {
        withoutEnlargement: true,
        fit: 'inside',
      })
      .jpeg({ quality: 85 })
      .toFile(filepath.replace(ext, '.jpg'));

    const finalFilename = filename.replace(ext, '.jpg');
    const url = `/uploads/${finalFilename}`;

    return NextResponse.json({ data: { url, filename: finalFilename }, error: null }, { status: 201 });
  } catch (e) {
    console.error('Upload error:', e);
    return NextResponse.json({ data: null, error: 'Upload failed' }, { status: 500 });
  }
}
