import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    let catalog = await db.catalog.findFirst({
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            components: { orderBy: { order: 'asc' } },
          },
        },
        settings: true,
      },
    });

    // Auto-create default catalog if none exists
    if (!catalog) {
      catalog = await db.catalog.create({
        data: {
          name: 'Mon Catalogue',
          slug: 'mon-catalogue',
          published: false,
          settings: {
            create: {
              language: 'fr',
              currency: 'MAD',
              whatsappNumber: '',
              messengerLink: '',
              emailContact: '',
              instagramHandle: '',
              primaryColor: '#C9A84C',
              secondaryColor: '#1A1A1A',
              accentColor: '#F5F0E8',
              backgroundColor: '#FAF8F5',
              fontFamily: 'inter',
              enableZoom: true,
              enableSearch: true,
              enableSharing: true,
              conversionChannel: 'whatsapp',
              conversionMessage: '',
              customCSS: '',
            },
          },
        },
        include: {
          sections: {
            orderBy: { order: 'asc' },
            include: {
              components: { orderBy: { order: 'asc' } },
            },
          },
          settings: true,
        },
      });
    }

    // SQLite returns JSON fields as strings — parse them for client compatibility
    const parsedCatalog = {
      ...catalog,
      sections: catalog.sections.map(section => ({
        ...section,
        config: typeof section.config === 'string' ? JSON.parse(section.config) : section.config,
        components: section.components.map(comp => ({
          ...comp,
          config: typeof comp.config === 'string' ? JSON.parse(comp.config) : comp.config,
        })),
      })),
    };

    return NextResponse.json(
      { data: parsedCatalog, error: null },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (e) {
    console.error('Catalog fetch error:', e);
    return NextResponse.json({ data: null, error: 'Failed to fetch catalog' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const catalog = await db.catalog.create({
      data: {
        name: body.name || 'Mon Catalogue',
        slug: body.slug || 'mon-catalogue',
        published: false,
        settings: {
          create: {
            language: 'fr',
            currency: 'MAD',
            primaryColor: '#C9A84C',
            secondaryColor: '#1A1A1A',
            accentColor: '#F5F0E8',
            backgroundColor: '#FAF8F5',
            fontFamily: 'inter',
            enableZoom: true,
            enableSearch: true,
            enableSharing: true,
            conversionChannel: 'whatsapp',
          },
        },
      },
      include: { sections: true, settings: true },
    });

    return NextResponse.json({ data: catalog, error: null }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to create catalog' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const catalog = await db.catalog.findFirst();

    if (!catalog) {
      return NextResponse.json({ data: null, error: 'No catalog found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.slug !== undefined) updateData.slug = body.slug;
    if (body.published !== undefined) updateData.published = body.published;

    const updated = await db.catalog.update({
      where: { id: catalog.id },
      data: updateData,
      include: {
        sections: {
          orderBy: { order: 'asc' },
          include: {
            components: { orderBy: { order: 'asc' } },
          },
        },
        settings: true,
      },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Failed to update catalog' }, { status: 500 });
  }
}
