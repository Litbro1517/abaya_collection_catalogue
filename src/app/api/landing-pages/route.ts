import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

// ── GET /api/landing-pages — List all landing pages ──
export async function GET() {
  try {
    const pages = await db.landingPage.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ data: pages, error: null });
  } catch (error) {
    console.error('[GET /api/landing-pages] Error:', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch landing pages' }, { status: 500 });
  }
}

// ── POST /api/landing-pages — Create a new landing page ──
export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json();
    const { title, slug, type, productId, desktopImageUrl, mobileImageUrl,
            showCtaTop, ctaTopText, showCtaMiddle, ctaMiddleText,
            showCtaBottom, ctaBottomText, htmlContent, active } = body;

    if (!title || !slug || !type || !productId) {
      return NextResponse.json({ data: null, error: 'Titre, slug, type et produit sont obligatoires.' }, { status: 400 });
    }

    const existing = await db.landingPage.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ data: null, error: 'Ce slug est déjà utilisé.' }, { status: 400 });
    }

    const page = await db.landingPage.create({
      data: {
        title, slug, type, productId,
        desktopImageUrl: desktopImageUrl || null,
        mobileImageUrl: mobileImageUrl || null,
        showCtaTop: showCtaTop ?? true,
        ctaTopText: ctaTopText || 'Commander Maintenant',
        showCtaMiddle: showCtaMiddle ?? true,
        ctaMiddleText: ctaMiddleText || "Profiter de l'Offre",
        showCtaBottom: showCtaBottom ?? true,
        ctaBottomText: ctaBottomText || 'Valider ma Commande',
        htmlContent: htmlContent || null,
        active: active ?? true,
      },
    });

    return NextResponse.json({ data: page, error: null }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/landing-pages] Error:', error);
    return NextResponse.json({ data: null, error: 'Failed to create landing page' }, { status: 500 });
  }
}
