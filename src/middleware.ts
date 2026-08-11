import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware — Route protection, auth enforcement & SEO bot interception
 *
 * Guards:
 *   #0 — Skip static assets (early exit for performance)
 *   #1 — Protect /admin route (owner/admin/super_admin only)
 *   #2 — Intercept social media crawlers → rewrite to ghost SSR route
 *   #3 — Protect auth-required API routes
 *   #4 — Protect admin write operations (POST/PUT/PATCH/DELETE)
 */

// ── Bot user-agent substrings for SEO interception ──
const BOT_AGENTS = [
  'facebookexternalhit',   // Facebook / WhatsApp link preview
  'Facebot',               // Facebook crawler variant
  'Twitterbot',            // Twitter card crawler
  'LinkedInBot',           // LinkedIn preview
  'Slackbot',              // Slack unfurler
  'Discordbot',            // Discord link preview
  'TelegramBot',           // Telegram preview
  'Googlebot',             // Google search indexer
  'bingbot',               // Bing indexer
  'Slurp',                 // Yahoo indexer
  'DuckDuckBot',           // DuckDuckGo
  'Discordbot-Preview',    // Discord variant
];

// Routes that require any authenticated admin
const AUTH_REQUIRED_ROUTES = [
  '/api/auth/admins',
  '/api/auth/change-password',
];

// Routes that require owner or admin role for write operations
const ADMIN_WRITE_ROUTES = [
  '/api/datasources',
  '/api/catalog',
  '/api/sections',
  '/api/settings',
  '/api/google/sync',
  '/api/orders',          // Admin orders management (GET list + PATCH status)
];

// Session cookie name
const ADMIN_TOKEN = 'admin_token';

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  const ua = req.headers.get('user-agent') || '';

  // ━━━ Guard #0 — Skip static assets ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Early exit for files that never need middleware processing.
  // This prevents unnecessary auth checks on images, CSS, JS, fonts, etc.
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('/favicon') ||
    pathname.match(/\.(ico|png|jpg|jpeg|gif|svg|webp|avif|mp4|webm|woff2?|ttf|eot|css|js|map)$/i)
  ) {
    return NextResponse.next();
  }

  // ━━━ Guard #2 — Intercept bot requests for SEO ━━━━━━━━━━━━━━━━━━━━━━
  // When a social media crawler requests /?product=slug, we rewrite
  // internally to /product-meta/[slug] which renders SSR meta tags.
  // The visitor's URL bar stays at /?product=slug — no redirect, no flash.
  const productSlug = searchParams.get('product');
  if (productSlug && isBot(ua)) {
    const rewriteUrl = new URL(`/product-meta/${productSlug}`, req.url);
    return NextResponse.rewrite(rewriteUrl);
  }

  // ━━━ Guard #1 — Protect /admin route ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // VG41.4: Allow unauthenticated users through to /admin so the Server
  // Component (admin/page.tsx) can render <AdminLoginPage />. The role-based
  // access control is handled by the Server Component itself — if no valid
  // admin session is found, it shows the login page. API write routes remain
  // protected by Guard #4 below.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    const token = req.cookies.get(ADMIN_TOKEN)?.value;
    if (!token) {
      // No token — let the Server Component render the login page
      return NextResponse.next();
    }

    try {
      const authRes = await fetch(new URL('/api/auth', req.url), {
        headers: { cookie: `${ADMIN_TOKEN}=${token}` },
      });
      const authJson = await authRes.json();

      if (!authJson.authenticated || !authJson.admin) {
        // Invalid/expired token — let the Server Component render the login page
        return NextResponse.next();
      }

      // Only owner, admin and super_admin roles can access /admin dashboard.
      // Other roles (editor) are still allowed through — the Server Component
      // will show them the login page with an "insufficient role" error.
      const role = authJson.admin.role;
      if (role !== 'owner' && role !== 'admin' && role !== 'super_admin') {
        return NextResponse.next();
      }

      // Authenticated admin with proper role — allow through with headers
      const res = NextResponse.next();
      res.headers.set('x-admin-id', authJson.admin.id);
      res.headers.set('x-admin-role', authJson.admin.role);
      return res;
    } catch {
      // Auth check failed (network error) — let the Server Component handle it
      return NextResponse.next();
    }
  }

  // ━━━ Guard #3 — Protect auth-required API routes ━━━━━━━━━━━━━━━━━━━━
  const token = req.cookies.get(ADMIN_TOKEN)?.value;
  const isAuthRequired = AUTH_REQUIRED_ROUTES.some(r => pathname.startsWith(r));
  const isPublicCheck = pathname.startsWith('/api/auth/admins') && searchParams.get('public_check') === 'true';
  if (isAuthRequired && !token && !isPublicCheck) {
    return NextResponse.json(
      { error: 'Non authentifié' },
      { status: 401 }
    );
  }

  // ━━━ Guard #4 — Protect admin write operations ━━━━━━━━━━━━━━━━━━━━━━
  const isAdminRoute = ADMIN_WRITE_ROUTES.some(r => pathname.startsWith(r));
  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

  // Exception: POST /api/orders is public (client COD checkout tunnel).
  // Only PATCH/PUT/DELETE on /api/orders/* require admin auth.
  // The GET /api/orders (list) is protected at the handler level via getCurrentAdmin().
  const isPublicOrderCreation = pathname === '/api/orders' && req.method === 'POST';

  if (isAdminRoute && isWriteMethod && !token && !isPublicOrderCreation) {
    return NextResponse.json(
      { error: 'Non authentifié' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

// ── Bot detection helper ──
function isBot(userAgent: string): boolean {
  const lower = userAgent.toLowerCase();
  return BOT_AGENTS.some(bot => lower.includes(bot.toLowerCase()));
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - api/auth (kept for backward compat)
     *
     * We need /?product=slug to be matched for bot interception,
     * so we include the root path.
     */
    '/((?!_next/static|_next/image).*)',
    '/',
  ],
};
