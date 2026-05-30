import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false });
    }

    const session = await db.adminSession.findUnique({
      where: { token },
    });

    if (!session || new Date(session.expiresAt) < new Date()) {
      return NextResponse.json({ authenticated: false });
    }

    return NextResponse.json({ authenticated: true });
  } catch (e) {
    return NextResponse.json({ authenticated: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    // Get admin password from settings
    const setting = await db.settings.findUnique({ where: { key: 'adminPassword' } });
    const adminPassword = setting?.value || 'abayachic2024';

    if (password !== adminPassword) {
      return NextResponse.json({ data: null, error: 'Mot de passe incorrect' }, { status: 401 });
    }

    // Create session
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await db.adminSession.create({
      data: { token, expiresAt },
    });

    const response = NextResponse.json({ data: { authenticated: true }, error: null });
    response.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return response;
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Login failed' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (token) {
      await db.adminSession.deleteMany({ where: { token } });
    }

    const response = NextResponse.json({ data: { authenticated: false }, error: null });
    response.cookies.set('admin_token', '', { expires: new Date(0), path: '/' });

    return response;
  } catch (e) {
    return NextResponse.json({ data: null, error: 'Logout failed' }, { status: 500 });
  }
}
