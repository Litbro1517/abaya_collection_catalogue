import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/categories
export async function GET() {
  try {
    const categories = await db.category.findMany({
      orderBy: { ordre: 'asc' },
    });
    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error('GET /api/categories error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/categories
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const category = await db.category.create({
      data: {
        nom: body.nom,
        slug: body.slug || body.nom.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
        ordre: body.ordre || 0,
        active: body.active !== false,
      },
    });
    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      return NextResponse.json({ error: 'Cette catégorie existe déjà' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/categories
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const category = await db.category.update({
      where: { id: body.id },
      data: {
        nom: body.nom,
        slug: body.slug,
        ordre: body.ordre,
        active: body.active,
      },
    });
    return NextResponse.json({ data: category });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
