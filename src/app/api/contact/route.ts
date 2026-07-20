import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ── POST /api/contact — Receive a contact message from the catalog modal ──
// Public endpoint (no auth required — visitors are not authenticated).
// Stores the message in the ContactMessage table for admin review.
//
// Body: { fromEmail: string, message: string, toEmail: string }
// Returns: 201 { data: { id } } on success, 400/500 on error.

const MAX_MESSAGE_LENGTH = 2000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fromEmail, message, toEmail } = body;

    // Validate required fields
    if (!fromEmail || typeof fromEmail !== 'string') {
      return NextResponse.json(
        { data: null, error: 'Adresse e-mail requise.' },
        { status: 400 }
      );
    }
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { data: null, error: 'Message requis.' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!EMAIL_REGEX.test(fromEmail.trim())) {
      return NextResponse.json(
        { data: null, error: 'Adresse e-mail invalide.' },
        { status: 400 }
      );
    }

    // Validate message length
    if (message.trim().length < 5) {
      return NextResponse.json(
        { data: null, error: 'Le message doit contenir au moins 5 caractères.' },
        { status: 400 }
      );
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { data: null, error: 'Le message ne peut pas dépasser 2000 caractères.' },
        { status: 400 }
      );
    }

    // Store the message in DB
    const contactMessage = await db.contactMessage.create({
      data: {
        fromEmail: fromEmail.trim().slice(0, 255),
        message: message.trim(),
        toEmail: (toEmail || '').trim().slice(0, 255),
      },
    });

    return NextResponse.json(
      { data: { id: contactMessage.id }, error: null },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/contact] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de l\'envoi du message.' },
      { status: 500 }
    );
  }
}

// ── GET /api/contact — List contact messages (admin only) ──
// Protected by getCurrentAdmin() — defense in depth.
import { getCurrentAdmin } from '@/lib/auth';

export async function GET() {
  try {
    const admin = await getCurrentAdmin();
    if (!admin || (admin.role !== 'owner' && admin.role !== 'admin' && admin.role !== 'super_admin')) {
      return NextResponse.json(
        { data: null, error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const messages = await db.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ data: messages, error: null });
  } catch (error) {
    console.error('[GET /api/contact] Error:', error);
    return NextResponse.json(
      { data: null, error: 'Erreur lors de la récupération des messages.' },
      { status: 500 }
    );
  }
}
