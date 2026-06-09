import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { normalizeColorName, generateColorSlug, validateAndNormalizeHex } from '@/lib/color-utils';

// ─── POST /api/colormap/import — Bulk create colors ─────────────────────
// Accepts an array of { name, hex } objects
// Normalizes each name, skips duplicates (existing name)
// Returns { created: number, skipped: number, errors: string[] }
// ─────────────────────────────────────────────────────────────────────────

interface ImportItem {
  name: string;
  hex: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: ImportItem[] = body.colors ?? body.items ?? body;

    // ── Validate input ──
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Le corps de la requête doit contenir un tableau "colors" non vide' },
        { status: 400 }
      );
    }

    // ── Limit batch size ──
    if (items.length > 500) {
      return NextResponse.json(
        { error: `Trop de couleurs à importer (${items.length}). Maximum: 500 par requête.` },
        { status: 400 }
      );
    }

    // ── Get existing slugs/names for dedup ──
    const existingColors = await db.colorMap.findMany({
      select: { name: true, slug: true },
    });
    const existingNameSet = new Set(existingColors.map(c => c.name));
    const existingSlugSet = new Set(existingColors.map(c => c.slug));

    // ── Get max ordre ──
    const maxOrdre = await db.colorMap.aggregate({
      _max: { ordre: true },
    });
    let nextOrdre = (maxOrdre._max.ordre ?? -1) + 1;

    const created: { name: string; slug: string; hex: string }[] = [];
    const skipped: { name: string; reason: string }[] = [];
    const errors: string[] = [];

    // ── Track in-batch duplicates ──
    const batchNameSet = new Set<string>();
    const batchSlugSet = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Validate item structure
      if (!item || typeof item !== 'object') {
        errors.push(`Élément ${i}: format invalide`);
        continue;
      }

      const { name: rawName, hex: rawHex } = item;

      // Validate name
      if (!rawName || typeof rawName !== 'string' || rawName.trim() === '') {
        errors.push(`Élément ${i}: le champ "name" est requis`);
        continue;
      }

      // Validate hex
      if (!rawHex || typeof rawHex !== 'string') {
        errors.push(`Élément ${i}: le champ "hex" est requis`);
        continue;
      }

      const hex = validateAndNormalizeHex(rawHex);
      if (!hex) {
        errors.push(`Élément ${i} ("${rawName}"): code hex invalide "${rawHex}"`);
        continue;
      }

      // Normalize
      const name = normalizeColorName(rawName);
      const slug = generateColorSlug(name);

      if (!name || !slug) {
        errors.push(`Élément ${i}: le nom normalisé est vide`);
        continue;
      }

      // Check DB duplicates
      if (existingNameSet.has(name) || existingSlugSet.has(slug)) {
        skipped.push({ name, reason: 'existe déjà en base' });
        continue;
      }

      // Check in-batch duplicates
      if (batchNameSet.has(name) || batchSlugSet.has(slug)) {
        skipped.push({ name, reason: 'doublon dans le lot' });
        continue;
      }

      // Mark as seen
      batchNameSet.add(name);
      batchSlugSet.add(slug);

      created.push({ name, slug, hex });
    }

    // ── Bulk insert ──
    let insertedCount = 0;
    if (created.length > 0) {
      // Use createMany for efficiency, but we need individual ordre values
      // So we use a transaction with individual creates
      await db.$transaction(
        created.map((item, index) =>
          db.colorMap.create({
            data: {
              name: item.name,
              slug: item.slug,
              hex: item.hex,
              ordre: nextOrdre + index,
              visible: true,
              isActive: true,
            },
          })
        )
      );
      insertedCount = created.length;
    }

    return NextResponse.json({
      data: {
        created: insertedCount,
        skipped: skipped.length,
        errors: errors.length,
        details: {
          created: created.map(c => c.name),
          skipped,
          errors,
        },
      },
    });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Conflit de contrainte unique lors de l\'import en masse' },
        { status: 409 }
      );
    }
    console.error('POST /api/colormap/import error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
