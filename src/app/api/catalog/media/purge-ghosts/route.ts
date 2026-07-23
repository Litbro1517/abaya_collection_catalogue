import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';

/**
 * POST /api/catalog/media/purge-ghosts
 * Deletes physical files from the CDN bucket that are NOT tracked by the database
 * (ghost files). Accepts a list of file names to delete, or "all" to purge all ghosts.
 *
 * Body: { files?: string[] }  — list of file names (e.g. ["abc123.webp", "def456.webp"])
 *       If files is omitted or empty, returns 400.
 *
 * Returns: { data: { deleted: number, errors: string[] } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { files } = body as { files?: string[] };

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'files[] array is required' },
        { status: 400 },
      );
    }

    let deletedCount = 0;
    const errors: string[] = [];

    const supabase = getSupabaseAdmin();
    if (supabase) {
      // Supabase: batch delete
      const paths = files.map((f) => `media/${f}`);
      const { error: delError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(paths);

      if (delError) {
        errors.push(`Supabase error: ${delError.message}`);
      } else {
        deletedCount = files.length;
      }
    } else {
      // Local fallback
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const localDir = path.join(process.cwd(), 'public', 'uploads', 'media');
        for (const fileName of files) {
          try {
            await fs.unlink(path.join(localDir, fileName));
            deletedCount++;
          } catch (e) {
            errors.push(`Failed to delete ${fileName}: ${e instanceof Error ? e.message : 'unknown'}`);
          }
        }
      } catch {
        errors.push('Local directory not accessible');
      }
    }

    return NextResponse.json({
      data: { deleted: deletedCount, errors: errors.length > 0 ? errors : undefined },
      error: null,
    });
  } catch (error) {
    console.error('Purge ghosts error:', error);
    return NextResponse.json(
      { error: 'Failed to purge ghost files' },
      { status: 500 },
    );
  }
}
