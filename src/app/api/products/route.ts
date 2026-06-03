import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Helper to parse JSON fields from SQLite strings
function parseProduct(product: Record<string, unknown>) {
  return {
    ...product,
    couleurs: JSON.parse((product.couleurs as string) || '[]'),
    tailles: JSON.parse((product.tailles as string) || '[]'),
    imagesCarousel: JSON.parse((product.imagesCarousel as string) || '[]'),
  };
}

// GET /api/products - List products (public or admin)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured');
    const available = searchParams.get('available');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '24');
    const admin = searchParams.get('admin') === 'true';

    const where: Record<string, unknown> = {};

    if (!admin) {
      where.disponible = true;
    } else if (available === 'true') {
      where.disponible = true;
    } else if (available === 'false') {
      where.disponible = false;
    }

    if (category && category !== 'tout') {
      const cat = await db.category.findUnique({ where: { slug: category } });
      if (cat) where.categorieId = cat.id;
    }

    if (search) {
      where.nomProduit = { contains: search };
    }

    if (featured === 'true') {
      where.featured = true;
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: { categorie: true },
        orderBy: { nOrdre: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    const parsedProducts = products.map(parseProduct);

    return NextResponse.json({
      data: parsedProducts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('GET /api/products error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/products - Create product
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const product = await db.product.create({
      data: {
        nomProduit: body.nomProduit,
        prixVente: parseFloat(body.prixVente),
        prixAchat: body.prixAchat ? parseFloat(body.prixAchat) : null,
        categorieId: body.categorieId || null,
        description: body.description || null,
        couleurs: JSON.stringify(body.couleurs || []),
        tailles: JSON.stringify(body.tailles || []),
        imagePrincipale: body.imagePrincipale || null,
        imagesCarousel: JSON.stringify(body.imagesCarousel || []),
        canalCommande: body.canalCommande || 'whatsapp',
        lienCommande: body.lienCommande || null,
        stock: parseInt(body.stock) || 0,
        nOrdre: parseInt(body.nOrdre) || 0,
        disponible: body.disponible !== false,
        featured: body.featured === true,
      },
      include: { categorie: true },
    });

    return NextResponse.json({ data: parseProduct(product) }, { status: 201 });
  } catch (error: unknown) {
    console.error('POST /api/products error:', error);
    const prismaError = error as { code?: string; meta?: { target?: string[] } };
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Un produit avec ce nom existe déjà' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
