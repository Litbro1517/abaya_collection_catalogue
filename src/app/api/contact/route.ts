import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAdmin } from '@/lib/auth';

// ── POST /api/contact — Receive a contact message from the catalog modal ──
// Public endpoint (no auth required — visitors are not authenticated).
// Stores the message in the ContactMessage table for admin review.
//
// Anti-spam: rate limiting by IP — max 1 message per 60 seconds.
// The last message timestamp from the same IP is checked in DB.
//
// Body: { fromEmail: string, message: string, toEmail: string }
// Returns: 201 { data: { id } } on success, 400/429/500 on error.

const MAX_MESSAGE_LENGTH = 2000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_MS = 60_000; // 60 seconds between messages from the same IP

// ── In-memory rate limit store (per server instance) ──
// Note: In serverless (Vercel), each instance has its own memory.
// This is a basic first layer. For production-grade, use Upstash Redis.
const rateLimitMap = new Map<string, number>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    // ── Rate limiting (A6 fix) ──
    const clientIp = getClientIp(req);
    const now = Date.now();
    const lastRequest = rateLimitMap.get(clientIp);
    if (lastRequest && (now - lastRequest) < RATE_LIMIT_MS) {
      const remaining = Math.ceil((RATE_LIMIT_MS - (now - lastRequest)) / 1000);
      return NextResponse.json(
        { data: null, error: `Trop de messages envoyés. Veuillez attendre ${remaining} secondes.` },
        { status: 429 }
      );
    }
    rateLimitMap.set(clientIp, now);

    // Clean up old entries (prevent memory leak)
    if (rateLimitMap.size > 1000) {
      for (const [ip, ts] of rateLimitMap.entries()) {
        if (now - ts > RATE_LIMIT_MS * 2) rateLimitMap.delete(ip);
      }
    }

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
