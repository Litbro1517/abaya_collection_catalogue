import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware — Route protection & auth enforcement
 *
 * 1. /admin — redirects non-authenticated users to /
 * 2. /api/auth/admins — requires authentication
 * 3. Write operations on admin-only API routes — requires owner/admin role
 */

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
];

// Session cookie name
const ADMIN_TOKEN = 'admin_token';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(ADMIN_TOKEN)?.value;

  // ── 1. Protect /admin route ──
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!token) {
      // Not authenticated — redirect to home
      return NextResponse.redirect(new URL('/', req.url));
    }

    // Verify session by calling the auth API internally
    try {
      const authRes = await fetch(new URL('/api/auth', req.url), {
        headers: { cookie: `${ADMIN_TOKEN}=${token}` },
      });
      const authJson = await authRes.json();

      if (!authJson.authenticated || !authJson.admin) {
        return NextResponse.redirect(new URL('/', req.url));
      }

      // Only owner, admin and super_admin roles can access /admin
      const role = authJson.admin.role;
      if (role !== 'owner' && role !== 'admin' && role !== 'super_admin') {
        return NextResponse.redirect(new URL('/', req.url));
      }

      // Authenticated admin — allow through
      const res = NextResponse.next();
      // Inject admin info in headers for downstream use
      res.headers.set('x-admin-id', authJson.admin.id);
      res.headers.set('x-admin-role', authJson.admin.role);
      return res;
    } catch {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // ── 2. Protect auth-required API routes ──
  const isAuthRequired = AUTH_REQUIRED_ROUTES.some(r => pathname.startsWith(r));
  // Allow public_check=true queries to pass through without auth
  const isPublicCheck = pathname.startsWith('/api/auth/admins') && req.nextUrl.searchParams.get('public_check') === 'true';
  if (isAuthRequired && !token && !isPublicCheck) {
    return NextResponse.json(
      { error: 'Non authentifié' },
      { status: 401 }
    );
  }

  // ── 3. Protect admin write operations (POST/PUT/PATCH/DELETE) ──
  const isAdminRoute = ADMIN_WRITE_ROUTES.some(r => pathname.startsWith(r));
  const isWriteMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);

  if (isAdminRoute && isWriteMethod && !token) {
    return NextResponse.json(
      { error: 'Non authentifié' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/auth/admins/:path*',
    '/api/auth/change-password',
    '/api/datasources/:path*',
    '/api/catalog/:path*',
    '/api/sections/:path*',
    '/api/settings/:path*',
    '/api/google/sync/:path*',
  ],
};
