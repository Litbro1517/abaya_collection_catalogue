import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, createAdminSession, auditLog } from '@/lib/auth';

/**
 * POST — Register the first admin (ONLY if no admins exist)
 */
export async function POST(req: NextRequest) {
  try {
    // Check if any admin already exists
    const adminCount = await db.adminUser.count();

    if (adminCount > 0) {
      return NextResponse.json(
        { error: 'L\'inscription est désactivée. Contactez un administrateur.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caractères' },
        { status: 400 }
      );
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Create the first admin with role='owner'
    const admin = await db.adminUser.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        passwordHash,
        role: 'owner',
        status: 'active',
      },
    });

    // Create session
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    const userAgent = req.headers.get('user-agent') ?? undefined;

    await createAdminSession(admin.id, ip, userAgent);

    // Audit log
    await auditLog(
      admin.id,
      'create',
      'auth',
      admin.id,
      { action: 'initial_registration', email: admin.email, role: 'owner' },
      ip
    );

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
      { error: 'Erreur lors de l\'inscription' },
      { status: 500 }
    );
  }
}
