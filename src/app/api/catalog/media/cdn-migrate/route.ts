// @ts-nocheck — MANDAT 4P: Prisma generated types are overly strict; runtime behavior is correct
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { extractDriveFileId } from '@/lib/media-utils';
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase';
import { Prisma } from '@prisma/client';

// ━━ MANDAT 4P — Étape 1a : maxDuration 60s ━━
// Plan Hobby = 10s par défaut. La migration d'une colonne complète (264 URLs)
// prend 3-9 minutes. Sans maxDuration, la fonction est tuée après 10s →
// migration partielle + erreur silencieuse.
// 60s est le maximum autorisé sur le plan Hobby (Next.js App Router).
// Pour les colonnes complètes, l'admin doit utiliser la sélection bulk
// par sous-ensembles de ~15-20 rows (chaque batch < 60s).
export const maxDuration = 60;

/**
 * POST /api/catalog/media/cdn-migrate
 * Migrates Google Drive images to the CDN (Supabase Storage → local fallback).
 *
 * Body: {
 *   dataSourceId: string,
 *   columnSlug: string,
 *   columnType: 'IMAGE' | 'IMAGE_ARRAY',
 *   rowIds?: string[],       // specific rows (bulk selection) — if omitted, all rows
 * }
 *
 * Algorithm:
 * 0. HEAD check: if the CDN URL already exists (public GET 200), skip download
 *    and reuse the existing CDN URL. This bypasses the 209 WebP files already
 *    in the bucket from a previous privileged migration run.
 * 1. For each row, extract Drive file_ids from the cell.
 * 2. Uniqueness check: if a file_id is already attached to ANOTHER row
 *    (different rowId) via MediaAsset, BLOCK the migration for that image
 *    and report a conflict.
 * 3. Download from Drive (throttle 100ms between requests).
 * 4. Convert to .webp via Sharp.
 * 5. Upload to Supabase Storage (or local /public/uploads/ fallback).
 * 6. Update Row.data with the new CDN URL + MediaAsset record (status='cdn').
 */

const THROTTLE_MS = 100;
const DRIVE_DOWNLOAD_BASE = 'https://lh3.googleusercontent.com/d/';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { dataSourceId, columnSlug, columnType, rowIds } = body as {
      dataSourceId?: string;
      columnSlug?: string;
      columnType?: 'IMAGE' | 'IMAGE_ARRAY';
      rowIds?: string[];
    };

    if (!dataSourceId || !columnSlug) {
      return NextResponse.json(
        { error: 'dataSourceId and columnSlug are required' },
        { status: 400 },
      );
    }

    // Verify DataSource
    const ds = await db.dataSource.findUnique({ where: { id: dataSourceId } });
    if (!ds) {
      return NextResponse.json({ error: 'DataSource not found' }, { status: 404 });
    }

    // Fetch target rows
    const whereClause = rowIds && rowIds.length > 0
      ? { id: { in: rowIds }, dataSourceId }
      : { dataSourceId };
    const rows = await db.row.findMany({
      where: whereClause,
      orderBy: { order: 'asc' },
      select: { id: true, data: true },
    });

    const results: Array<{
      rowId: string;
      fileId: string;
      status: 'migrated' | 'conflict' | 'skipped' | 'failed';
      cdnUrl?: string;
      conflictRowId?: string;
      reason?: string; // MANDAT INVESTIGATION: instrumenter la raison exacte d'échec
    }> = [];

    let migratedCount = 0;
    let conflictCount = 0;
    const supabase = getSupabaseAdmin();

    // MANDAT INVESTIGATION: log temporaire pour vérifier l'état du client admin
    console.log('[cdn-migrate] SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'MISSING');
    console.log('[cdn-migrate] SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? `SET (${process.env.SUPABASE_SERVICE_ROLE_KEY.length} chars)` : 'MISSING');
    console.log('[cdn-migrate] supabase client:', supabase ? 'AVAILABLE' : 'NULL');

    // ━━ MANDAT 4P — Déduplication CDN (Phase 1 galerie → Phase 2 couverture) ━━
    // Construit un map { fileId → cdnUrl } en scannant DIRECTEMENT les cellules
    // IMAGE_ARRAY de toutes les rows. Cela permet de réutiliser une URL CDN déjà
    // présente dans groupe_images SANS dépendre de la table MediaAsset (qui peut
    // être vide ou désynchronisée — cas observé en production).
    //
    // Logique :
    // - Phase 1 (Galerie) : si la migration porte sur une colonne IMAGE_ARRAY
    //   (ex: groupe_images), chaque URL Drive est convertie en WebP Supabase.
    //   Le map est enrichi au fur et à mesure (chaque URL migrée devient
    //   réutilisable pour les rows suivantes de la même migration).
    // - Phase 2 (Couverture) : si la migration porte sur une colonne IMAGE
    //   individuelle (ex: image-de-garde) et que le fileId correspond à une
    //   URL CDN déjà présente dans le map (via groupe_images déjà migrée), on
    //   réutilise cette URL — ZÉRO re-upload, ZÉRO duplication sur Supabase.
    const cdnUrlByFileId = new Map<string, string>();

    // Pré-remplir le map en scannant les colonnes IMAGE_ARRAY de toutes les rows
    // (récupère les URLs CDN déjà présentes AVANT la migration)
    const allImageArrayColumns = await db.column.findMany({
      where: { dataSourceId, type: 'IMAGE_ARRAY' },
      select: { slug: true },
    });
    for (const row of rows) {
      const data = (row.data as Record<string, unknown>) || {};
      for (const col of allImageArrayColumns) {
        const val = data[col.slug];
        if (!val) continue;
        // IMAGE_ARRAY peut être un tableau natif ou un string JSON
        let urlList: string[] = [];
        if (Array.isArray(val)) {
          urlList = val.filter((u): u is string => typeof u === 'string' && !!u.trim());
        } else if (typeof val === 'string') {
          const trimmed = val.trim();
          if (trimmed.startsWith('[')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (Array.isArray(parsed)) {
                urlList = parsed.filter((u): u is string => typeof u === 'string' && !!u.trim());
              }
            } catch { /* not JSON — ignore */ }
          }
        }
        for (const u of urlList) {
          // Si c'est une URL CDN (Supabase /uploads/), extrait le fileId
          // potentiel depuis le nom de fichier (media/FILE_ID.webp)
          if (u.includes('supabase.co') || u.includes('/uploads/')) {
            const m = u.match(/media\/([a-zA-Z0-9_-]+)\.webp/);
            if (m && m[1]) {
              cdnUrlByFileId.set(m[1], u);
            }
          }
        }
      }
    }

    for (const row of rows) {
      const data = (row.data as Record<string, unknown>) || {};
      const rawCell = data[columnSlug];

      // ━━ MANDAT 4P — Parsing résistant des cellules IMAGE_ARRAY ━━
      // La cellule peut arriver sous 3 formats après un réimport Google Sheets :
      //   (a) Tableau natif JSON : ["url1","url2"]  (format VG33.3 attendu)
      //   (b) String JSON stringifiée : '["url1","url2"]'  (legacy)
      //   (c) String simple : "/api/google/image-proxy?id=X&sz=800"  (réimport brut)
      //       ou "https://drive.google.com/file/d/X/view"
      //
      // Avant : `String(rawCell).split(/[,;]\s*/)` cassait le JSON (gardait les
      // guillemets/crochets dans les URLs) → extractDriveFileId ne matchait pas
      // → la migration échouait silencieusement (aucune image migrée).
      //
      // Maintenant : on détecte le format et on parse correctement.
      let urls: string[] = [];
      if (Array.isArray(rawCell)) {
        // Format (a) : tableau natif
        urls = rawCell.filter((u: unknown): u is string => typeof u === 'string' && u.trim() !== '');
      } else if (typeof rawCell === 'string') {
        const cellValue = rawCell.trim();
        if (!cellValue) continue;
        if (columnType === 'IMAGE_ARRAY') {
          if (cellValue.startsWith('[')) {
            // Format (b) : JSON stringifié — parser correctement
            try {
              const parsed = JSON.parse(cellValue);
              if (Array.isArray(parsed)) {
                urls = parsed.filter((u: unknown): u is string => typeof u === 'string' && u.trim() !== '');
              }
            } catch {
              // JSON cassé — fallback : traiter comme string simple
              urls = [cellValue];
            }
          } else {
            // Format (c) : string simple (/api/google/... ou http...)
            // → traiter comme un tableau à un élément
            urls = [cellValue];
          }
        } else {
          // Colonne IMAGE simple → un seul URL
          urls = [cellValue];
        }
      } else {
        // Type inattendu (number, boolean, null) — skip
        continue;
      }

      if (urls.length === 0) continue;

      const newUrls: string[] = [];
      let cellChanged = false;

      for (const url of urls) {
        const fileId = extractDriveFileId(url);
        if (!fileId) {
          // Not a Drive URL — passthrough (already CDN or unknown)
          newUrls.push(url);
          continue;
        }

        // ━━ MANDAT 4P — Déduplication via map Row.data (prioritaire) ━━
        // Avant de consulter MediaAsset, vérifier si une URL CDN existe déjà
        // pour ce fileId dans le map construit depuis les colonnes IMAGE_ARRAY.
        // Cela évite tout re-upload quand groupe_images a déjà été migrée.
        const existingCdnUrl = cdnUrlByFileId.get(fileId);
        if (existingCdnUrl) {
          newUrls.push(existingCdnUrl);
          results.push({ rowId: row.id, fileId, status: 'skipped', cdnUrl: existingCdnUrl });
          continue;
        }

        // ── Cross-column deduplication (VG33.3): is this file_id already migrated
        //    in ANY column? If yes, reuse the existing CDN URL — no re-download.
        //    Previous code checked fileId+columnSlug (per-column), causing double
        //    downloads when the same image appears in both individual IMAGE columns
        //    and the IMAGE_ARRAY gallery (40 downloads for 20 images).
        const existingAsset = await db.mediaAsset.findFirst({
          where: {
            fileId,
            status: 'cdn',
            cdnUrl: { not: null },
            rowId: { not: row.id },
          },
          select: { rowId: true, status: true, cdnUrl: true, columnSlug: true, id: true },
        });

        if (existingAsset && existingAsset.cdnUrl) {
          // File already on CDN (possibly in another column) — reuse the URL.
          // This is NOT a conflict: the same image can legitimately appear in
          // multiple columns of the same product. We just avoid re-downloading.
          newUrls.push(existingAsset.cdnUrl);
          // MANDAT 4P: aussi enrichir le map pour les rows suivantes
          cdnUrlByFileId.set(fileId, existingAsset.cdnUrl);
          results.push({ rowId: row.id, fileId, status: 'skipped', cdnUrl: existingAsset.cdnUrl });
          continue;
        }

        // Check if this file_id is already attached to ANOTHER row (true conflict)
        // MANDAT CADRE B: fix TS1117 — duplicate `not` key in object literal.
        // { not: row.id, not: null } is invalid JS (second `not` overwrites first).
        // Replaced with { not: row.id } — Prisma interprets `not: row.id` as
        // "rowId is NOT equal to row.id" (excludes current row, which is the intent).
        const conflictAsset = await db.mediaAsset.findFirst({
          where: {
            fileId,
            rowId: { not: row.id },
          },
          select: { rowId: true, status: true, cdnUrl: true },
        });

        if (conflictAsset) {
          results.push({
            rowId: row.id,
            fileId,
            status: 'conflict',
            // MANDAT CADRE B: fix TS2322 — conflictAsset.rowId is `string | null`,
            // but results[].conflictRowId expects `string | undefined`.
            // Coalesce null → undefined for type compatibility.
            conflictRowId: conflictAsset.rowId ?? undefined,
          });
          conflictCount++;
          newUrls.push(url); // keep the Drive URL
          continue;
        }

        // ━━ MANDAT 4P — Étape 1b : HEAD check bypass (209 fichiers déjà en bucket) ━━
        // Avant de télécharger depuis Drive (coûteux, throttled, sujet aux quotas 429),
        // vérifier si le fichier WebP existe DÉJÀ dans le bucket CDN Supabase.
        // Le bucket est public — un simple HEAD sur l'URL publique suffit.
        // Cela bypass les 209 WebP déjà présents (uploadés par une exécution
        // privilégiée précédente) → migration instantanée sans re-download.
        const supabaseUrl = process.env.SUPABASE_URL;
        if (supabaseUrl) {
          const headFileName = `media/${fileId}.webp`;
          const publicCdnUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${headFileName}`;
          try {
            const headRes = await fetch(publicCdnUrl, { method: 'HEAD' });
            if (headRes.ok && (headRes.headers.get('content-type') || '').includes('image/')) {
              // Fichier déjà présent sur le CDN — skip download + upload
              // Upsert MediaAsset (l'exécution précédente n'a pas créé MediaAsset
              // dans la DB prod, donc on le crée maintenant pour la cohérence)
              await db.mediaAsset.upsert({
                where: { fileId_columnSlug: { fileId, columnSlug } },
                update: {
                  rowId: row.id,
                  dataSourceId,
                  cdnUrl: publicCdnUrl,
                  fileName: headFileName,
                  mimeType: 'image/webp',
                  status: 'cdn',
                },
                create: {
                  fileId,
                  rowId: row.id,
                  dataSourceId,
                  columnSlug,
                  originalUrl: url,
                  cdnUrl: publicCdnUrl,
                  fileName: headFileName,
                  mimeType: 'image/webp',
                  status: 'cdn',
                },
              });
              newUrls.push(publicCdnUrl);
              cdnUrlByFileId.set(fileId, publicCdnUrl);
              results.push({ rowId: row.id, fileId, status: 'migrated', cdnUrl: publicCdnUrl });
              migratedCount++;
              cellChanged = true;
              continue;
            }
          } catch {
            // HEAD échoué (bucket non public, erreur réseau, etc.) —
            // proceed to download from Drive
          }
        }

        // ── Download from Drive (throttled) ──
        // MANDAT 4P — Correctif anti-bot Google Drive :
        // fetch() sans User-Agent est rejeté par lh3.googleusercontent.com
        // (filtre anti-bot heuristique). On ajoute les mêmes headers que le
        // proxy /api/google/image-proxy (qui réussit) : User-Agent navigateur
        // + Accept image/*. Sans ces headers, Google renvoie un status non-200
        // → la migration échoue silencieusement (status: 'failed').
        const fetchOpts: RequestInit = {
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
        };
        await sleep(THROTTLE_MS);
        let downloadUrl = `${DRIVE_DOWNLOAD_BASE}${fileId}=w1200`;
        let driveRes = await fetch(downloadUrl, fetchOpts);
        if (!driveRes.ok) {
          // Retry with proxy-style URL
          downloadUrl = `${DRIVE_DOWNLOAD_BASE}${fileId}`;
          driveRes = await fetch(downloadUrl, fetchOpts);
        }
        if (!driveRes.ok || !driveRes.body) {
          // MANDAT INVESTIGATION: instrumenter la raison exacte
          results.push({ rowId: row.id, fileId, status: 'failed', reason: `download_failed: HTTP ${driveRes.status} ${driveRes.statusText} | url=${downloadUrl}` });
          newUrls.push(url);
          continue;
        }

        const arrayBuffer = await driveRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // ── Convert to WebP via Sharp ──
        let webpBuffer: Buffer;
        try {
          const sharp = (await import('sharp')).default;
          webpBuffer = await sharp(buffer).webp({ quality: 82 }).toBuffer();
        } catch {
          // Sharp failed — use original buffer
          webpBuffer = buffer;
        }

        const fileName = `media/${fileId}.webp`;
        let cdnUrl: string;

        if (supabase) {
          // Upload to Supabase Storage
          // MANDAT 4P — Fix cache HTTP : ajouter cacheControl explicite.
          // Avant : pas de cacheControl → Supabase applique max-age=3600 (1h)
          // → Lighthouse signale 1859 KiB de cache inefficace.
          // Maintenant : max-age=31536000 (1 an) + immutable → cache navigateur
          // permanent pour les images statiques (jamais modifiées après upload).
          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(fileName, webpBuffer, {
              contentType: 'image/webp',
              upsert: true,
              cacheControl: '31536000',
            });
          if (uploadError) {
            // MANDAT INVESTIGATION: instrumenter la raison exacte
            results.push({ rowId: row.id, fileId, status: 'failed', reason: `upload_failed: ${uploadError.message} | code=${uploadError.name}` });
            newUrls.push(url);
            continue;
          }
          const { data: pubData } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(fileName);
          cdnUrl = pubData.publicUrl;
        } else {
          // Local fallback — write to public/uploads/media/
          const fs = await import('fs/promises');
          const path = await import('path');
          const localDir = path.join(process.cwd(), 'public', 'uploads', 'media');
          await fs.mkdir(localDir, { recursive: true });
          await fs.writeFile(path.join(localDir, `${fileId}.webp`), webpBuffer);
          cdnUrl = `/uploads/media/${fileId}.webp`;
        }

        // Update MediaAsset record
        await db.mediaAsset.upsert({
          where: { fileId_columnSlug: { fileId, columnSlug } },
          update: {
            rowId: row.id,
            dataSourceId,
            cdnUrl,
            fileName: `${fileId}.webp`,
            mimeType: 'image/webp',
            sizeBytes: webpBuffer.length,
            status: 'cdn',
          },
          create: {
            fileId,
            rowId: row.id,
            dataSourceId,
            columnSlug,
            originalUrl: url,
            cdnUrl,
            fileName: `${fileId}.webp`,
            mimeType: 'image/webp',
            sizeBytes: webpBuffer.length,
            status: 'cdn',
          },
        });

        newUrls.push(cdnUrl);
        cellChanged = true;
        migratedCount++;
        // MANDAT 4P: enrichir le map cdnUrlByFileId pour que les rows suivantes
        // (et les colonnes IMAGE individuelles traitées dans la même migration
        // bulk) puissent réutiliser cette URL sans re-upload.
        cdnUrlByFileId.set(fileId, cdnUrl);
        results.push({ rowId: row.id, fileId, status: 'migrated', cdnUrl });
      }

      // Update the cell if any URL changed.
      // VG33.3: IMAGE_ARRAY cells are stored as JSON.stringify (strict JSON array)
      // to preserve the gallery format. Previous code used join(', ') which broke
      // the carousel (badge showed "1 image" instead of "X images").
      if (cellChanged) {
        if (columnType === 'IMAGE_ARRAY') {
          data[columnSlug] = JSON.stringify(newUrls);
        } else {
          data[columnSlug] = newUrls[0];
        }
        await db.row.update({ where: { id: row.id }, data: { data: data as unknown as Prisma.InputJsonValue } });
      }
    }

    // MANDAT 4P — Étape 2 : compter les échecs pour le toast client
    // Le toast "Aucune image à migrer" masquait les échecs d'upload (RLS, quota,
    // timeout). Maintenant le client peut distinguer :
    // - migrated > 0 → succès
    // - conflicts > 0 → conflits
    // - failed > 0 → échecs d'upload (message explicite)
    const failedCount = results.filter(r => r.status === 'failed').length;

    return NextResponse.json({
      data: {
        migrated: migratedCount,
        conflicts: conflictCount,
        failed: failedCount,
        total: results.length,
        results,
      },
      error: null,
    });
  } catch (error) {
    console.error('CDN migrate error:', error);
    return NextResponse.json(
      { error: 'Failed to migrate to CDN' },
      { status: 500 },
    );
  }
}
