import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifyPassword,
  createAdminSession,
  getCurrentAdmin,
  auditLog,
} from '@/lib/auth';

/**
 * GET — Check auth status
 */
export async function GET() {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json({ authenticated: false, admin: null });
    }

    return NextResponse.json({
      authenticated: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        picture: admin.picture,
        role: admin.role,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false, admin: null });
  }
}

/**
 * POST — Login with email + password
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      );
    }

    // Find admin user by email with active status
    const admin = await db.adminUser.findFirst({
      where: {
        email: email.toLowerCase().trim(),
        status: 'active',
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    // Check if user has a password set
    if (!admin.passwordHash) {
      return NextResponse.json(
        { error: 'Ce compte utilise Google pour se connecter' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, admin.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    // Create session
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;

    await createAdminSession(admin.id, ip, userAgent);

    // Audit log
    await auditLog(admin.id, 'login', 'auth', undefined, undefined, ip);

    return NextResponse.json({
      data: {
        authenticated: true,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          picture: admin.picture,
          role: admin.role,
        },
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors de la connexion' },
      { status: 500 }
    );
  }
}

/**
 * DELETE — Logout
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (token) {
      // Find session to get adminId for audit log
      const session = await db.adminSession.findUnique({
        where: { token },
      });

      if (session) {
        // Audit log before deleting session
        await auditLog(session.adminId, 'logout', 'auth');

        // Delete the session
        await db.adminSession.delete({ where: { id: session.id } });
      }
    }

    const response = NextResponse.json({ data: { success: true } });
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookies.set('admin_token', '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      expires: new Date(0),
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors de la déconnexion' },
      { status: 500 }
    );
  }
}
