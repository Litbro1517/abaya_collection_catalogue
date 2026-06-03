import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, auditLog, verifyPassword, hashPassword } from '@/lib/auth';

/**
 * POST — Change own password
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Mot de passe actuel et nouveau mot de passe requis' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'Le nouveau mot de passe doit contenir au moins 8 caractères' },
        { status: 400 }
      );
    }

    // Get the full admin record with passwordHash
    const fullAdmin = await db.adminUser.findUnique({
      where: { id: admin.id },
    });

    if (!fullAdmin) {
      return NextResponse.json({ error: 'Administrateur introuvable' }, { status: 404 });
    }

    // If user has no password (Google-only account), they can't change password this way
    if (!fullAdmin.passwordHash) {
      return NextResponse.json(
        { error: 'Ce compte utilise Google pour se connecter. Impossible de changer le mot de passe.' },
        { status: 400 }
      );
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, fullAdmin.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Mot de passe actuel incorrect' },
        { status: 401 }
      );
    }

    // Hash and update the new password
    const newPasswordHash = await hashPassword(newPassword);
    await db.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash: newPasswordHash },
    });

    // Audit log
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    await auditLog(admin.id, 'update', 'auth', admin.id, { action: 'change_password' }, ip);

    return NextResponse.json({ data: { success: true } });
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors du changement de mot de passe' },
      { status: 500 }
    );
  }
}
