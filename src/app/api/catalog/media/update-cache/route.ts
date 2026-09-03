import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';

/**
 * POST /api/catalog/media/update-cache
 *
 * MANDAT 4P — Fix cache HTTP retroactif
 *
 * Met a jour le cacheControl de TOUS les fichiers .webp deja presents
 * dans le bucket Supabase Storage (assets/media/*.webp).
 *
 * Strategie : liste tous les fichiers du bucket, telecharge chaque fichier
 * depuis son URL publique (rapide, deja en cache CDN Cloudflare), puis
 * le re-upload avec upsert:true + cacheControl:'31536000' (1 an).
 * Le telechargement est rapide (fichier deja en cache CDN) et ne consomme
 * pas de bande passante Drive.
 */

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase admin client not available' },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { prefix = 'media/', dryRun = false } = body as {
      prefix?: string;
      dryRun?: boolean;
    };

    // Etape 1 : Lister tous les fichiers dans media/
    const { data: files, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(prefix, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (listError) {
      return NextResponse.json(
        { error: `List failed: ${listError.message}` },
        { status: 500 }
      );
    }

    if (!files || files.length === 0) {
      return NextResponse.json({
        data: { total: 0, updated: 0, failed: 0, message: 'No files found' },
        error: null,
      });
    }

    // Filtrer uniquement les .webp
    const webpFiles = files.filter(
      (f) => f.name.endsWith('.webp') && (f.id ?? '').indexOf('/') !== 0
    );

    if (dryRun) {
      return NextResponse.json({
        data: {
          total: webpFiles.length,
          updated: 0,
          failed: 0,
          message: `Dry run: ${webpFiles.length} .webp files would be updated`,
          files: webpFiles.map((f) => f.name),
        },
        error: null,
      });
    }

    // Etape 2 : Pour chaque fichier, telecharger depuis URL publique
    // (rapide, deja en cache CDN) puis re-upload avec cacheControl: 31536000
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const results: Array<{ file: string; status: 'updated' | 'failed'; error?: string }> = [];
    let updatedCount = 0;
    let failedCount = 0;

    for (const file of webpFiles) {
      const fileName = `${prefix}${file.name}`;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${fileName}`;

      try {
        const downloadRes = await fetch(publicUrl);
        if (!downloadRes.ok) {
          results.push({ file: file.name, status: 'failed', error: `Download failed: HTTP ${downloadRes.status}` });
          failedCount++;
          continue;
        }

        const buffer = Buffer.from(await downloadRes.arrayBuffer());

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(fileName, buffer, {
            contentType: 'image/webp',
            upsert: true,
            cacheControl: '31536000',
          });

        if (uploadError) {
          results.push({ file: file.name, status: 'failed', error: uploadError.message });
          failedCount++;
        } else {
          results.push({ file: file.name, status: 'updated' });
          updatedCount++;
        }
      } catch (e) {
        results.push({
          file: file.name,
          status: 'failed',
          error: e instanceof Error ? e.message : String(e),
        });
        failedCount++;
      }
    }

    return NextResponse.json({
      data: {
        total: webpFiles.length,
        updated: updatedCount,
        failed: failedCount,
        results: results.slice(0, 50),
      },
      error: null,
    });
  } catch (error) {
    console.error('Update cache error:', error);
    return NextResponse.json(
      { error: 'Failed to update cache control' },
      { status: 500 }
    );
  }
}
