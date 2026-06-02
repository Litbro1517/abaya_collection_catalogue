import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAdmin, auditLog, hashPassword } from '@/lib/auth';

/**
 * GET — List all admins (requires auth, role: owner or admin)
 * Or with ?public_check=true — returns { hasAdmins: boolean } without auth
 */
export async function GET(req: NextRequest) {
  try {
    // Public check: only return whether any admins exist (no auth required)
    const publicCheck = new URL(req.url).searchParams.get('public_check');
    if (publicCheck === 'true') {
      const count = await db.adminUser.count();
      return NextResponse.json({ hasAdmins: count > 0 });
    }

    // Authenticated list endpoint
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    if (admin.role !== 'owner' && admin.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const admins = await db.adminUser.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        role: true,
        status: true,
        googleSub: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ data: admins });
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des administrateurs' },
      { status: 500 }
    );
  }
}

/**
 * POST — Add a new admin (requires owner role)
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    if (admin.role !== 'owner') {
      return NextResponse.json({ error: 'Seul le propriétaire peut ajouter des administrateurs' }, { status: 403 });
    }

    const body = await req.json();
    const { email, name, role, password } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'L\'email est requis' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await db.adminUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Un administrateur avec cet email existe déjà' },
        { status: 409 }
      );
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'editor'];
    const assignedRole = validRoles.includes(role) ? role : 'admin';

    // Hash password if provided
    const passwordHash = password ? await hashPassword(password) : null;

    const newAdmin = await db.adminUser.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        role: assignedRole,
        status: 'active',
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // Audit log
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    await auditLog(
      admin.id,
      'create',
      'admin',
      newAdmin.id,
      { email: newAdmin.email, name: newAdmin.name, role: assignedRole },
      ip
    );

    return NextResponse.json({ data: newAdmin }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'administrateur' },
      { status: 500 }
    );
  }
}

/**
 * PATCH — Update an admin's role or status (requires owner role)
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    if (admin.role !== 'owner') {
      return NextResponse.json({ error: 'Seul le propriétaire peut modifier les administrateurs' }, { status: 403 });
    }

    const body = await req.json();
    const { adminId, role, status } = body;

    if (!adminId) {
      return NextResponse.json({ error: 'ID de l\'administrateur requis' }, { status: 400 });
    }

    // Cannot modify yourself
    if (adminId === admin.id) {
      return NextResponse.json({ error: 'Vous ne pouvez pas modifier votre propre rôle ou statut' }, { status: 400 });
    }

    const targetAdmin = await db.adminUser.findUnique({ where: { id: adminId } });
    if (!targetAdmin) {
      return NextResponse.json({ error: 'Administrateur introuvable' }, { status: 404 });
    }

    // If demoting an owner, check they're not the last one
    if (targetAdmin.role === 'owner' && role && role !== 'owner') {
      const ownerCount = await db.adminUser.count({ where: { role: 'owner' } });
      if (ownerCount <= 1) {
        return NextResponse.json({ error: 'Impossible de modifier le dernier propriétaire' }, { status: 400 });
      }
    }

    // Validate role if provided
    const validRoles = ['owner', 'admin', 'editor'];
    const validStatuses = ['active', 'suspended'];

    const updateData: Record<string, string> = {};
    if (role && validRoles.includes(role)) updateData.role = role;
    if (status && validStatuses.includes(status)) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification valide' }, { status: 400 });
    }

    // If suspending, kill all their sessions
    if (status === 'suspended') {
      await db.adminSession.deleteMany({ where: { adminId } });
    }

    const updatedAdmin = await db.adminUser.update({
      where: { id: adminId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    await auditLog(admin.id, 'update', 'admin', adminId, { ...updateData, targetEmail: targetAdmin.email }, ip);

    return NextResponse.json({ data: updatedAdmin });
  } catch {
    return NextResponse.json({ error: 'Erreur lors de la modification de l\'administrateur' }, { status: 500 });
  }
}

/**
 * DELETE — Remove an admin (requires owner role)
 */
export async function DELETE(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    if (admin.role !== 'owner') {
      return NextResponse.json({ error: 'Seul le propriétaire peut supprimer des administrateurs' }, { status: 403 });
    }

    const body = await req.json();
    const { adminId } = body;

    if (!adminId) {
      return NextResponse.json(
        { error: 'ID de l\'administrateur requis' },
        { status: 400 }
      );
    }

    // Cannot delete yourself
    if (adminId === admin.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer votre propre compte' },
        { status: 400 }
      );
    }

    // Find the target admin
    const targetAdmin = await db.adminUser.findUnique({
      where: { id: adminId },
    });

    if (!targetAdmin) {
      return NextResponse.json(
        { error: 'Administrateur introuvable' },
        { status: 404 }
      );
    }

    // Cannot delete the last owner
    if (targetAdmin.role === 'owner') {
      const ownerCount = await db.adminUser.count({
        where: { role: 'owner' },
      });

      if (ownerCount <= 1) {
        return NextResponse.json(
          { error: 'Impossible de supprimer le dernier propriétaire' },
          { status: 400 }
        );
      }
    }

    // Delete the admin's sessions first, then the admin
    await db.adminSession.deleteMany({
      where: { adminId },
    });

    await db.adminUser.delete({
      where: { id: adminId },
    });

    // Audit log
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    await auditLog(
      admin.id,
      'delete',
      'admin',
      adminId,
      { deletedEmail: targetAdmin.email, deletedName: targetAdmin.name, deletedRole: targetAdmin.role },
      ip
    );

    return NextResponse.json({ data: { success: true } });
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'administrateur' },
      { status: 500 }
    );
  }
}
