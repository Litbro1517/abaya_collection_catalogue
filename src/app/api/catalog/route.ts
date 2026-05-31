import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

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

    // Json fields (config) are returned as native objects by Prisma with PostgreSQL
    return NextResponse.json({ data: catalog, error: null });
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
