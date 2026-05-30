import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function parseProduct(product: Record<string, unknown>) {
  return {
    ...product,
    couleurs: JSON.parse((product.couleurs as string) || '[]'),
    tailles: JSON.parse((product.tailles as string) || '[]'),
    imagesCarousel: JSON.parse((product.imagesCarousel as string) || '[]'),
  };
}

// GET /api/products/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const product = await db.product.findUnique({
      where: { id },
      include: { categorie: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ data: parseProduct(product) });
  } catch (error) {
    console.error('GET /api/products/[id] error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/products/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updateData: Record<string, unknown> = {};

    if (body.nomProduit !== undefined) updateData.nomProduit = body.nomProduit;
    if (body.prixVente !== undefined) updateData.prixVente = parseFloat(body.prixVente);
    if (body.prixAchat !== undefined) updateData.prixAchat = body.prixAchat ? parseFloat(body.prixAchat) : null;
    if (body.categorieId !== undefined) updateData.categorieId = body.categorieId || null;
    if (body.description !== undefined) updateData.description = body.description || null;
    if (body.couleurs !== undefined) updateData.couleurs = JSON.stringify(body.couleurs);
    if (body.tailles !== undefined) updateData.tailles = JSON.stringify(body.tailles);
    if (body.imagePrincipale !== undefined) updateData.imagePrincipale = body.imagePrincipale || null;
    if (body.imagesCarousel !== undefined) updateData.imagesCarousel = JSON.stringify(body.imagesCarousel);
    if (body.canalCommande !== undefined) updateData.canalCommande = body.canalCommande;
    if (body.lienCommande !== undefined) updateData.lienCommande = body.lienCommande || null;
    if (body.stock !== undefined) updateData.stock = parseInt(body.stock) || 0;
    if (body.nOrdre !== undefined) updateData.nOrdre = parseInt(body.nOrdre) || 0;
    if (body.disponible !== undefined) updateData.disponible = body.disponible;
    if (body.featured !== undefined) updateData.featured = body.featured;

    const product = await db.product.update({
      where: { id },
      data: updateData,
      include: { categorie: true },
    });

    return NextResponse.json({ data: parseProduct(product) });
  } catch (error: unknown) {
    console.error('PATCH /api/products/[id] error:', error);
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/products/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('DELETE /api/products/[id] error:', error);
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
