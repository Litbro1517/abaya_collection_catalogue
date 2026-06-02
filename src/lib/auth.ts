import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const SALT_ROUNDS = 12;
const SESSION_DURATION_HOURS = 24;

/**
 * Hash a password with bcrypt (salt rounds: 12)
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create an admin session and set cookie
 * Returns the session token
 */
export async function createAdminSession(
  adminId: string,
  ip?: string,
  userAgent?: string
): Promise<string> {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await db.adminSession.create({
    data: {
      token,
      adminId,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set('admin_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    expires: expiresAt,
    path: '/',
  });

  return token;
}

/**
 * Get current admin from cookie
 * Returns the AdminUser (without passwordHash) or null if not authenticated
 */
export async function getCurrentAdmin() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return null;
    }

    const session = await db.adminSession.findUnique({
      where: { token },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
            picture: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!session || new Date(session.expiresAt) < new Date()) {
      // Clean up expired session
      if (session) {
        await db.adminSession.delete({ where: { id: session.id } }).catch(() => {});
      }
      return null;
    }

    if (session.admin.status !== 'active') {
      return null;
    }

    return session.admin;
  } catch {
    return null;
  }
}

/**
 * Log an audit action
 */
export async function auditLog(
  adminId: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>,
  ip?: string
): Promise<void> {
  await db.auditLog.create({
    data: {
      adminId,
      action,
      entity,
      entityId: entityId ?? null,
      details: details ?? {},
      ip: ip ?? null,
    },
  });
}
