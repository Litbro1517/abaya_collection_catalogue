import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

// ── GET /api/landing-pages/[id] — Get single landing page ──
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const page = await db.landingPage.findUnique({ where: { id } });
    if (!page) {
      return NextResponse.json({ data: null, error: 'Landing page not found' }, { status: 404 });
    }
    return NextResponse.json({ data: page, error: null });
  } catch (error) {
    console.error('[GET /api/landing-pages/[id]] Error:', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch landing page' }, { status: 500 });
  }
}

// ── PUT /api/landing-pages/[id] — Update landing page ──
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, slug, type, productId, desktopImageUrl, mobileImageUrl,
            showCtaTop, ctaTopText, showCtaMiddle, ctaMiddleText,
            showCtaBottom, ctaBottomText, htmlContent, active } = body;

    const existing = await db.landingPage.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ data: null, error: 'Landing page not found' }, { status: 404 });
    }

    if (slug && slug !== existing.slug) {
      const slugConflict = await db.landingPage.findUnique({ where: { slug } });
      if (slugConflict) {
        return NextResponse.json({ data: null, error: 'Ce slug est déjà utilisé.' }, { status: 400 });
      }
    }

    const page = await db.landingPage.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(slug !== undefined && { slug }),
        ...(type !== undefined && { type }),
        ...(productId !== undefined && { productId: productId || null }),
        ...(desktopImageUrl !== undefined && { desktopImageUrl: desktopImageUrl || null }),
        ...(mobileImageUrl !== undefined && { mobileImageUrl: mobileImageUrl || null }),
        ...(showCtaTop !== undefined && { showCtaTop }),
        ...(ctaTopText !== undefined && { ctaTopText }),
        ...(showCtaMiddle !== undefined && { showCtaMiddle }),
        ...(ctaMiddleText !== undefined && { ctaMiddleText }),
        ...(showCtaBottom !== undefined && { showCtaBottom }),
        ...(ctaBottomText !== undefined && { ctaBottomText }),
        ...(htmlContent !== undefined && { htmlContent: htmlContent || null }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json({ data: page, error: null });
  } catch (error) {
    console.error('[PUT /api/landing-pages/[id]] Error:', error);
    return NextResponse.json({ data: null, error: 'Failed to update landing page' }, { status: 500 });
  }
}

// ── DELETE /api/landing-pages/[id] — Delete landing page ──
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) {
      return NextResponse.json({ data: null, error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;
    await db.landingPage.delete({ where: { id } });
    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error('[DELETE /api/landing-pages/[id]] Error:', error);
    return NextResponse.json({ data: null, error: 'Failed to delete landing page' }, { status: 500 });
  }
}
