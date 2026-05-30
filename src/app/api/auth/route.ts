import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ADMIN_PASSWORD } from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.adminSession.create({
      data: { token, expiresAt },
    });

    const response = NextResponse.json({ success: true, token });
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;

  if (token) {
    await db.adminSession.deleteMany({ where: { token } }).catch(() => {});
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_token', '', { maxAge: 0, path: '/' });
  return response;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const session = await db.adminSession.findUnique({ where: { token } });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await db.adminSession.delete({ where: { token } }).catch(() => {});
    }
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true });
}
