'use client';

import { useEffect } from 'react';

/**
 * MANDAT 4P — UTM Attribution Capture
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Hook + composant pour capturer les paramètres d'origine (utm_source,
 * utm_medium, utm_campaign, fbclid, gclid) depuis l'URL au premier
 * chargement, et les persister en sessionStorage pour la durée de la
 * session navigateur.
 *
 * Performance : le composant <UtmCapture /> retourne null et l'effet
 * tourne après hydratation (idle) — zéro impact sur FCP/LCP/TBT.
 *
 * Sécurité : liste blanche stricte (seuls les paramètres connus sont
 * capturés, max 256 caractères par valeur), pas de PII.
 */

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'] as const;
const STORAGE_KEY = 'abaya_attribution';
const MAX_VALUE_LENGTH = 256;

export interface AttributionData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
}

/**
 * Capture UTM params from URL on first load, persist to sessionStorage.
 * Called once per session via <UtmCapture /> mounted in layout.
 */
export function useUtmCapture(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const attribution: AttributionData = {};
      let hasData = false;

      for (const key of UTM_KEYS) {
        const val = params.get(key);
        if (val && val.length <= MAX_VALUE_LENGTH) {
          attribution[key] = val;
          hasData = true;
        }
      }

      if (hasData) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
      }
    } catch {
      // sessionStorage may be unavailable (private browsing) — silently skip
    }
  }, []);
}

/**
 * Read stored attribution from sessionStorage.
 * Returns null if no attribution was captured.
 */
export function getStoredAttribution(): AttributionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AttributionData;
  } catch {
    return null;
  }
}

/**
 * UtmCapture component — renders null, runs the capture hook.
 * Mount in root layout to capture UTM on every page entry.
 */
export function UtmCapture(): null {
  useUtmCapture();
  return null;
}
