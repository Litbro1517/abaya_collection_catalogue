import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/google/image-proxy
 * Proxy Google Drive images to bypass CORS — high-res quality fix
 *
 * Priority order (matches Glide's strategy):
 *   1. lh3.googleusercontent.com/d/FILE_ID=w{sz}   ← best quality
 *   2. drive.google.com/thumbnail?id=FILE_ID&sz=w{sz}
 *   3. drive.google.com/uc?export=view&id=FILE_ID
 *   4. Google Drive API alt=media (OAuth)
 *
 * Key fix: use `sz=w1200` instead of `sz=1200` — the `w` prefix
 * explicitly requests a width-based resize; without it Google often
 * returns a tiny ~165×220px thumbnail regardless of the sz value.
 *
 * Query params:
 *   id: string  - Google Drive file ID (required)
 *   sz: string  - Desired image width in px (default: 1600, min: 800, max: 2400)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('id');
    const rawSz = parseInt(searchParams.get('sz') || '1600', 10);
    // Clamp between 800 and 2400 to avoid absurd sizes
    const sz = Math.min(Math.max(rawSz, 800), 2400);

    if (!fileId) {
      return NextResponse.json(
        { data: null, error: 'File ID (id) is required' },
        { status: 400 }
      );
    }

    // ── Candidate URLs in priority order ──
    const candidates = [
      {
        url: `https://lh3.googleusercontent.com/d/${fileId}=w${sz}`,
        source: 'lh3',
      },
      {
        url: `https://drive.google.com/thumbnail?id=${fileId}&sz=w${sz}`,
        source: 'thumbnail-w',
      },
      {
        url: `https://drive.google.com/uc?export=view&id=${fileId}`,
        source: 'content',
      },
    ];

    // Shared fetch options
    const fetchOpts: RequestInit = {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    };

    // ── Try each candidate in order ──
    for (const candidate of candidates) {
      try {
        const res = await fetch(candidate.url, fetchOpts);

        if (!res.ok) continue;

        const contentType = res.headers.get('content-type') || '';
        const buffer = await res.arrayBuffer();

        // Verify it's actually an image (not a Google error page or HTML redirect)
        if (
          (contentType.startsWith('image/') || contentType === 'application/octet-stream') &&
          buffer.byteLength > 500
        ) {
          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType || 'image/jpeg',
              'Cache-Control': 'public, max-age=7200, s-maxage=7200, stale-while-revalidate=86400',
              'Access-Control-Allow-Origin': '*',
              'X-Proxy-Source': candidate.source,
              'X-Requested-Size': String(sz),
            },
          });
        }
      } catch {
        // This candidate failed, try the next one
      }
    }

    // ── Strategy 4: OAuth access token if available ──
    try {
      const { getValidAccessToken } = await import('@/lib/google/auth');
      const tokenInfo = await getValidAccessToken();

      if (tokenInfo) {
        const apiRes = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          {
            headers: { Authorization: `Bearer ${tokenInfo.accessToken}` },
            redirect: 'follow',
          }
        );

        if (apiRes.ok) {
          const contentType = apiRes.headers.get('content-type') || '';
          const buffer = await apiRes.arrayBuffer();

          if (contentType.startsWith('image/') && buffer.byteLength > 500) {
            return new NextResponse(buffer, {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=7200, s-maxage=7200, stale-while-revalidate=86400',
                'Access-Control-Allow-Origin': '*',
                'X-Proxy-Source': 'oauth',
                'X-Requested-Size': String(sz),
              },
            });
          }
        }
      }
    } catch {
      // OAuth strategy failed
    }

    // ── All methods failed — return SVG placeholder ──
    const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
      <rect width="600" height="800" fill="#F5F0E8"/>
      <rect x="270" y="360" width="60" height="60" rx="8" fill="#E8E2D9"/>
      <path d="M290 400 L300 385 L310 400 Z" fill="#C9A84C" opacity="0.5"/>
      <circle cx="295" cy="375" r="5" fill="#C9A84C" opacity="0.5"/>
      <text x="300" y="440" text-anchor="middle" fill="#808080" font-family="Inter, sans-serif" font-size="13">Image non disponible</text>
    </svg>`;

    return new NextResponse(placeholderSvg, {
      status: 404,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    console.error('Image proxy error:', e);

    const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
      <rect width="600" height="800" fill="#F5F0E8"/>
      <text x="300" y="400" text-anchor="middle" fill="#800020" font-family="Inter, sans-serif" font-size="14">Erreur de chargement</text>
    </svg>`;

    return new NextResponse(errorSvg, {
      status: 500,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
