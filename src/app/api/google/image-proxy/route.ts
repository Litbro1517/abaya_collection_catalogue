import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/google/image-proxy
 * Proxy Google Drive images to bypass CORS
 *
 * Query params:
 *   id: string  - Google Drive file ID (required)
 *   sz: string  - Image size (default: 800)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get('id');
    const sz = searchParams.get('sz') || '800';

    if (!fileId) {
      return NextResponse.json(
        { data: null, error: 'File ID (id) is required' },
        { status: 400 }
      );
    }

    // Try thumbnail URL first (more reliable for images)
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=${sz}`;

    try {
      const thumbRes = await fetch(thumbnailUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
        },
      });

      if (thumbRes.ok) {
        const contentType = thumbRes.headers.get('content-type') || 'image/jpeg';
        const buffer = await thumbRes.arrayBuffer();

        // Verify it's actually an image (not a Google error page)
        if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
              'Access-Control-Allow-Origin': '*',
              'X-Proxy-Source': 'thumbnail',
            },
          });
        }
      }
    } catch {
      // Thumbnail failed, try fallback
    }

    // Fallback: direct content URL
    const contentUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    try {
      const contentRes = await fetch(contentUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ImageProxy/1.0)',
        },
      });

      if (contentRes.ok) {
        const contentType = contentRes.headers.get('content-type') || 'image/jpeg';
        const buffer = await contentRes.arrayBuffer();

        if (contentType.startsWith('image/') || contentType === 'application/octet-stream') {
          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
              'Access-Control-Allow-Origin': '*',
              'X-Proxy-Source': 'content',
            },
          });
        }
      }
    } catch {
      // Content URL also failed
    }

    // Both methods failed - return a simple SVG placeholder
    const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#f0f0f0"/>
      <text x="200" y="185" text-anchor="middle" fill="#999" font-family="Arial, sans-serif" font-size="16">Image unavailable</text>
      <text x="200" y="215" text-anchor="middle" fill="#bbb" font-family="Arial, sans-serif" font-size="12">ID: ${fileId.slice(0, 12)}...</text>
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

    // Return a minimal SVG error placeholder
    const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="#f0f0f0"/>
      <text x="200" y="200" text-anchor="middle" fill="#e74c3c" font-family="Arial, sans-serif" font-size="14">Image proxy error</text>
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
