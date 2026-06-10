import { db } from '@/lib/db';
import { DEFAULT_SEED_COLORS } from '@/lib/color-utils';
import { NextResponse } from 'next/server';

// ─── POST /api/colormap/setup ───────────────────────────────────────
// Create the color_map table if it doesn't exist, then seed defaults
// This is needed because prisma db push may time out in some environments
export async function POST() {
  try {
    // Step 1: Create the table using raw SQL if it doesn't exist
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS color_map (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        hex TEXT NOT NULL,
        ordre INTEGER NOT NULL DEFAULT 0,
        visible BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Step 2: Create indexes if they don't exist
    try {
      await db.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS color_map_name_key ON color_map(name);
      `);
      await db.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS color_map_slug_key ON color_map(slug);
      `);
    } catch {
      // Indexes may already exist, that's fine
    }

    // Step 3: Seed default colors (idempotent)
    let created = 0;
    let existing = 0;

    // Get current max order
    let nextOrder = 0;
    try {
      const maxOrder = await db.colorMap.findFirst({
        orderBy: { ordre: 'desc' },
        select: { ordre: true },
      });
      nextOrder = (maxOrder?.ordre ?? -1) + 1;
    } catch {
      // Table might have just been created, start from 0
      nextOrder = 0;
    }

    for (const seed of DEFAULT_SEED_COLORS) {
      try {
        const found = await db.colorMap.findFirst({
          where: { name: seed.name },
        });

        if (found) {
          existing++;
        } else {
          // Generate slug from name
          const slug = seed.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');

          await db.colorMap.create({
            data: {
              name: seed.name,
              slug,
              hex: seed.hex,
              ordre: nextOrder,
              visible: true,
            },
          });
          created++;
          nextOrder++;
        }
      } catch {
        // Skip if individual seed fails (e.g., race condition)
        existing++;
      }
    }

    return NextResponse.json({
      data: {
        tableCreated: true,
        seeded: { created, existing, total: created + existing },
      },
      error: null,
    });
  } catch (e) {
    console.error('ColorMap setup error:', e);
    return NextResponse.json({ data: null, error: 'Failed to setup color map table' }, { status: 500 });
  }
}
