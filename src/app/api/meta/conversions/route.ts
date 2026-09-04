/**
 * MANDAT 4P — RECTIFICATIONS AUDIT 360° (P0 Tracking)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * POST /api/meta/conversions — pont serveur Meta Conversions API (CAPI).
 *
 * Rôle : recevoir les événements e-commerce du client (PageView, ViewContent,
 * AddToCart, InitiateCheckout, Purchase) porteurs d'un event_id UNIQUE déjà
 * envoyé au Pixel navigateur, et les re-transmettre au Graph API Meta avec
 * le MÊME event_id → déduplication Meta sur (event_name, event_id).
 *
 * Env requises (Vercel) :
 *   - META_PIXEL_ID (ou NEXT_PUBLIC_META_PIXEL_ID) : ID du Pixel
 *   - META_CAPI_ACCESS_TOKEN : token system user avec permission events
 *
 * Garanties :
 *   - 200 { ok:false, reason:'meta_capi_not_configured' } si env absentes →
 *     dégradation gracieuse (le site fonctionne sans tracking, jamais de 500)
 *   - Whitelist stricte des event_name (les 5 standard) — endpoint public,
 *     pas de passe-plat arbitraire vers Meta
 *   - custom_data réduit aux champs e-commerce connus (pas d'objets arbitraires)
 *   - Limite de taille du corps (8 Ko) + timeout Graph API (6 s) + rate limit
 *     en mémoire par IP (60 req/min) — hygiène anti-abus
 *   - user_data limité aux champs standard CAPI : IP + User-Agent
 */

import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
]);

const ALLOWED_CUSTOM_KEYS = new Set([
  'value',
  'currency',
  'content_ids',
  'contents',
  'content_type',
  'num_items',
  'order_id',
  'content_name',
  'search_string',
]);

const GRAPH_API_VERSION = 'v19.0';
const MAX_BODY_BYTES = 8 * 1024;
const CAPI_TIMEOUT_MS = 6000;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

// ── Rate limit en mémoire (best-effort, par IP) ──
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

interface ConversionBody {
  event_name?: unknown;
  event_id?: unknown;
  custom_data?: unknown;
  event_source_url?: unknown;
}

function sanitizeCustomData(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (ALLOWED_CUSTOM_KEYS.has(key) && value !== undefined && value !== null) {
      out[key] = value;
    }
  }
  return out;
}

function getClientIp(req: NextRequest): string | undefined {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') || undefined;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // ── Garde : rate limit ──
    const ip = getClientIp(req) || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { ok: false, reason: 'rate_limited' },
        { status: 429 }
      );
    }

    // ── Garde : taille du corps ──
    const contentLength = Number(req.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, reason: 'payload_too_large' },
        { status: 413 }
      );
    }

    // ── Validation du corps ──
    let body: ConversionBody;
    try {
      body = (await req.json()) as ConversionBody;
    } catch {
      return NextResponse.json(
        { ok: false, reason: 'invalid_json' },
        { status: 400 }
      );
    }

    const eventName = typeof body.event_name === 'string' ? body.event_name : '';
    const eventId = typeof body.event_id === 'string' ? body.event_id : '';

    if (!ALLOWED_EVENTS.has(eventName)) {
      return NextResponse.json(
        { ok: false, reason: 'event_not_allowed' },
        { status: 400 }
      );
    }
    // event_id : 8 à 128 caractères — sinon Meta refuse de toute façon
    if (eventId.length < 8 || eventId.length > 128) {
      return NextResponse.json(
        { ok: false, reason: 'invalid_event_id' },
        { status: 400 }
      );
    }

    const pixelId = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN || '';

    // ── Dégénérescence gracieuse : env non configurées ──
    // (le tracking est optionnel — l'endpoint répond 200 pour ne jamais
    // surfacer d'erreur client tant que les vars Vercel ne sont pas posées)
    if (!pixelId || !accessToken) {
      return NextResponse.json({
        ok: false,
        reason: 'meta_capi_not_configured',
        forwarded: false,
      });
    }

    const userAgent = req.headers.get('user-agent') || undefined;
    const clientIp = getClientIp(req);
    const eventSourceUrl =
      typeof body.event_source_url === 'string' ? body.event_source_url.slice(0, 500) : undefined;

    const capiEvent: Record<string, unknown> = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      custom_data: sanitizeCustomData(body.custom_data),
    };
    if (eventSourceUrl) capiEvent.event_source_url = eventSourceUrl;
    const userData: Record<string, unknown> = {};
    if (clientIp) userData.client_ip_address = clientIp;
    if (userAgent) userData.client_user_agent = userAgent;
    if (Object.keys(userData).length > 0) capiEvent.user_data = userData;

    // ── Appel Graph API avec timeout ──
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CAPI_TIMEOUT_MS);
    try {
      const graphUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;
      const graphRes = await fetch(graphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [capiEvent] }),
        signal: controller.signal,
      });
      const graphStatus = graphRes.status;
      // Ne pas relayer le corps Graph (peut contenir des détails du token)
      return NextResponse.json({
        ok: graphStatus >= 200 && graphStatus < 300,
        forwarded: true,
        graph_status: graphStatus,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Timeout réseau / erreur inattendue — jamais de 500 bruyant
    return NextResponse.json(
      { ok: false, reason: 'capi_unreachable', forwarded: false },
      { status: 200 }
    );
  }
}

export function GET(): NextResponse {
  // Sonde de santé : indique la configuration SANS exposer de secret
  const pixelId = process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN || '';
  return NextResponse.json({
    endpoint: '/api/meta/conversions',
    method: 'POST',
    configured: pixelId !== '' && accessToken !== '',
    pixel_configured: pixelId !== '',
    capi_token_configured: accessToken !== '',
  });
}
