/**
 * MANDAT 4P — RECTIFICATIONS AUDIT 360° (P0 Tracking Meta Pixel + CAPI)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Pont client Meta Pixel + Conversions API avec déduplication event_id.
 *
 * Constat audit DUEL 360° (VOLET 3, 0/25) : aucune balise Meta Pixel, aucun
 * événement serveur CAPI, aucune déduplication → attribution publicitaire
 * impossible (risque business #1 pour un e-commerce COD au Maroc).
 *
 * Architecture du pont (pattern officiel Meta « event_id deduplication ») :
 *   1. Le CLIENT génère un event_id unique (crypto.randomUUID).
 *   2. Le même event_id est envoyé AUX DEUX destinations :
 *        a. Meta Pixel navigateur : fbq('track', EVENT, customData, {eventID})
 *        b. Conversions API serveur : POST /api/meta/conversions
 *   3. Meta déduplique les événements sur la paire (event_name, event_id)
 *      dans une fenêtre de 48h → un seul événement comptabilisé, avec la
 *      robustesse serveur (adblock, iOS ATT) ET la richité client.
 *
 * Événements standard couverts : PageView, ViewContent, AddToCart,
 * InitiateCheckout, Purchase.
 *
 * Sécurité/garanties :
 *   - No-op total quand NEXT_PUBLIC_META_PIXEL_ID est absent (zéro requête)
 *   - SSR guard (no-op serveur)
 *   - Jamais d'exception (try/catch — le tracking ne doit JAMAIS casser l'UX)
 *   - fetch keepalive → survit à la navigation
 */

import type { DataLayerEvent, EcommerceItem } from './analytics';

/** Événements standard Meta autorisés (whitelist). */
export type MetaStandardEvent =
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'Purchase';

/** Mapping GA4 (dataLayer) → Meta standard events. Les événements non mappés sont ignorés. */
const GA4_TO_META: Record<string, MetaStandardEvent> = {
  page_view: 'PageView',
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
};

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';

/** Le Pixel est-il activé côté client (ID configuré au build) ? */
export function isMetaPixelEnabled(): boolean {
  return typeof window !== 'undefined' && META_PIXEL_ID !== '';
}

/**
 * Génère un event_id unique partagé client/serveur pour la déduplication.
 * Format : UUID v4 si disponible, sinon identifiant temps+aléatoire.
 */
export function generateMetaEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // crypto indisponible (contexte non sécurisé) — fallback
  }
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type FbqFn = (
  method: 'track' | 'trackCustom' | 'init',
  eventName: string,
  customData?: Record<string, unknown>,
  extra?: { eventID?: string }
) => void;

function getFbq(): FbqFn | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { fbq?: FbqFn };
  return typeof w.fbq === 'function' ? w.fbq : null;
}

/** Construit custom_data Meta depuis un DataLayerEvent GA4 (ecommerce + champs plats). */
function buildMetaCustomData(event: DataLayerEvent): Record<string, unknown> {
  const ec = event.ecommerce;
  const custom: Record<string, unknown> = {};

  const value =
    typeof ec?.value === 'number' ? ec.value : typeof event.value === 'number' ? event.value : undefined;
  if (value !== undefined) custom.value = value;

  custom.currency = ec?.currency || event.currency || 'MAD';

  const items: EcommerceItem[] | undefined = Array.isArray(ec?.items) ? ec.items : undefined;
  if (items && items.length > 0) {
    custom.content_type = 'product';
    custom.content_ids = items.map((i) => String(i.item_id));
    custom.contents = items.map((i) => ({
      id: String(i.item_id),
      quantity: typeof i.quantity === 'number' && i.quantity > 0 ? i.quantity : 1,
      item_price: typeof i.price === 'number' ? i.price : undefined,
    }));
    custom.num_items = items.reduce((acc, i) => acc + (typeof i.quantity === 'number' && i.quantity > 0 ? i.quantity : 1), 0);
  }

  const txn = ec?.transaction_id || event.transaction_id || event.order_id;
  if (txn) custom.order_id = String(txn);

  return custom;
}

/**
 * Miroir serveur CAPI d'un événement déjà tracké côté Pixel (même event_id).
 * Tolérant : n'échoue jamais silencieusement de manière bruyante (catch tout).
 */
function sendToCapi(
  eventName: MetaStandardEvent,
  eventId: string,
  customData: Record<string, unknown>
): void {
  try {
    const payload: Record<string, unknown> = {
      event_name: eventName,
      event_id: eventId,
      custom_data: customData,
    };
    if (typeof window !== 'undefined' && window.location && window.location.href) {
      payload.event_source_url = window.location.href;
    }
    void fetch('/api/meta/conversions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // CAPI best-effort — l'échec réseau est ignoré
    });
  } catch {
    // jamais d'exception depuis le tracking
  }
}

/**
 * Track un événement Meta standard : Pixel navigateur + CAPI serveur,
 * avec event_id partagé (déduplication Meta sur (event_name, event_id)).
 * Retourne l'event_id généré (utile pour les appels manuels), ou null si
 * non applicable (Pixel désactivé / événement non mappé / SSR).
 */
export function trackMetaEvent(
  eventName: MetaStandardEvent,
  customData?: Record<string, unknown>,
  eventId?: string
): string | null {
  if (!isMetaPixelEnabled()) return null;
  try {
    const eid = eventId || generateMetaEventId();
    const fbq = getFbq();
    if (fbq) {
      fbq('track', eventName, customData || {}, { eventID: eid });
    }
    sendToCapi(eventName, eid, customData || {});
    return eid;
  } catch {
    return null;
  }
}

/**
 * Pont automatique dataLayer → Meta : mappe l'événement GA4 vers l'événement
 * Meta standard correspondant (si mappé) et le track avec déduplication.
 * Appelé par pushDataLayer() — un seul point de passage, zéro site d'appel
 * à modifier.
 */
export function trackMetaFromGa4(event: DataLayerEvent): void {
  if (!isMetaPixelEnabled()) return;
  const metaEvent = GA4_TO_META[event.event];
  if (!metaEvent) return;
  trackMetaEvent(metaEvent, buildMetaCustomData(event));
}
