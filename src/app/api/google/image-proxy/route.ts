import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/google/image-proxy
 * Proxy Google Drive images to bypass CORS — with high-res support
 *
 * Query params:
 *   id: string  - Google Drive file ID (required)
 *   sz: string  - Image size (default: 1200)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('id');
    const rawSz = parseInt(searchParams.get('sz') || '1200', 10);
    // Google Drive thumbnail API works best with specific sizes; cap at 1920
    const sz = Math.min(rawSz, 1920);

    if (!fileId) {
      return NextResponse.json(
        { data: null, error: 'File ID (id) is required' },
        { status: 400 }
      );
    }

    // Strategy 1: Google Drive thumbnail API (reliable, respects size)
    // Use larger sizes for high-DPI displays
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=${sz}`;

    try {
      const thumbRes = await fetch(thumbnailUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (thumbRes.ok) {
        const contentType = thumbRes.headers.get('content-type') || '';
        const buffer = await thumbRes.arrayBuffer();

        // Verify it's actually an image (not a Google error page or HTML)
        if (
          (contentType.startsWith('image/') || contentType === 'application/octet-stream') &&
          buffer.byteLength > 500 // Minimum size for a real image
        ) {
          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType || 'image/jpeg',
              'Cache-Control': 'public, max-age=7200, s-maxage=7200, stale-while-revalidate=86400',
              'Access-Control-Allow-Origin': '*',
              'X-Proxy-Source': 'thumbnail',
            },
          });
        }
      }
    } catch {
      // Thumbnail failed, try fallback
    }

    // Strategy 2: Direct content URL (higher quality but may fail for large files)
    const contentUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    try {
      const contentRes = await fetch(contentUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      });

      if (contentRes.ok) {
        const contentType = contentRes.headers.get('content-type') || '';
        const buffer = await contentRes.arrayBuffer();

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
              'X-Proxy-Source': 'content',
            },
          });
        }
      }
    } catch {
      // Content URL also failed
    }

    // Strategy 3: Try with OAuth access token if available
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
              },
            });
          }
        }
      }
    } catch {
      // OAuth strategy failed
    }

    // All methods failed - return SVG placeholder
    const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750">
      <rect width="600" height="750" fill="#F5F0E8"/>
      <rect x="270" y="340" width="60" height="60" rx="8" fill="#E8E2D9"/>
      <path d="M290 380 L300 365 L310 380 Z" fill="#C9A84C" opacity="0.5"/>
      <circle cx="295" cy="355" r="5" fill="#C9A84C" opacity="0.5"/>
      <text x="300" y="420" text-anchor="middle" fill="#808080" font-family="Inter, sans-serif" font-size="13">Image non disponible</text>
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

    const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="750" viewBox="0 0 600 750">
      <rect width="600" height="750" fill="#F5F0E8"/>
      <text x="300" y="375" text-anchor="middle" fill="#800020" font-family="Inter, sans-serif" font-size="14">Erreur de chargement</text>
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
