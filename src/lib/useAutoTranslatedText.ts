'use client';

/**
 * useAutoTranslatedText — Traduction automatique dynamique (DEBT-10)
 *
 * Architecture mono-champ BDD : les titres et descriptions produits sont
 * stockés dans une seule langue (généralement arabe ou français selon le
 * vendeur). Lorsque le visiteur bascule la locale du catalogue, ce hook
 * déclenche une traduction à la volée via l'API /api/translate (z-ai-web-dev-sdk).
 *
 * Cache multi-niveaux pour préserver les performances :
 * 1. Cache mémoire React (useRef) — évite les re-renders pendant la session
 * 2. Cache localStorage — persiste entre les sessions (TTL 30 jours)
 *
 * Comportement :
 * - Si la locale cible === locale source (détection automatique) → retourne le texte brut
 * - Si la traduction est en cache → retourne immédiatement (synchrone)
 * - Sinon → retourne le texte brut initialement, déclenche la traduction async,
 *   puis met à jour l'état quand la réponse arrive (re-render React)
 *
 * Utilisation :
 *   const translated = useAutoTranslatedText(originalText, currentLocale);
 *   // translated = texte traduit si disponible, sinon texte original
 */

import { useEffect, useRef, useState } from 'react';

// ── Cache localStorage (30 jours) ──
// DEBT-10 production repair : bump prefix _v2_ pour invalider les anciens caches corrompus
const CACHE_KEY_PREFIX = 'abaya_translation_v2_';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

interface CacheEntry {
  translated: string;
  timestamp: number;
}

function readCache(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.translated;
  } catch {
    return null;
  }
}

function writeCache(key: string, translated: string): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry = { translated, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Quota exceeded or storage disabled — silently ignore
  }
}

// ── Cache mémoire partagé entre toutes les instances du hook ──
const memoryCache = new Map<string, string>();

// ── File d'attente pour éviter les doublons de requêtes ──
const pendingRequests = new Map<string, Promise<string>>();

// ━━ DEBT-10 production repair : détection automatique de la langue source ━━
export function detectSourceLangCode(text: string): 'ar' | 'fr' {
  if (!text) return 'fr';
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  return arabicChars > latinChars * 0.5 ? 'ar' : 'fr';
}

async function fetchTranslation(
  text: string,
  targetLang: string,
): Promise<string> {
  const cacheKey = `${CACHE_KEY_PREFIX}${targetLang}:${text.trim().toLowerCase()}`;

  // 1. Cache mémoire
  const memCached = memoryCache.get(cacheKey);
  if (memCached) return memCached;

  // 2. Cache localStorage
  const lsCached = readCache(cacheKey);
  if (lsCached) {
    memoryCache.set(cacheKey, lsCached);
    return lsCached;
  }

  // 3. Requête déjà en cours ? Attendre
  const pending = pendingRequests.get(cacheKey);
  if (pending) return pending;

  // 4. Démarrer nouvelle requête
  const promise = (async () => {
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          targetLangs: [targetLang],
          sourceLang: detectSourceLangCode(text),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const translated = json.data?.[targetLang];
      if (!translated || typeof translated !== 'string') {
        throw new Error('Invalid response');
      }
      // Mettre en cache
      memoryCache.set(cacheKey, translated);
      writeCache(cacheKey, translated);
      return translated;
    } catch (err) {
      // En cas d'erreur, retourner le texte original (pas de crash)
      console.warn('[useAutoTranslatedText] Translation failed:', err);
      return text;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  })();

  pendingRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Hook principal.
 *
 * @param text - Le texte original (depuis la BDD)
 * @param targetLang - La locale cible du visiteur ('fr', 'en', 'ar')
 * @returns Le texte traduit (ou le texte original si pas encore traduit)
 */
export function useAutoTranslatedText(
  text: string,
  targetLang: string,
): string {
  const [translated, setTranslated] = useState<string>(text);
  const lastTextRef = useRef<string>('');
  const lastLangRef = useRef<string>('');

  // ━━ DEBT-10 repair : détection automatique de la langue source ━━
  function needsTranslation(text: string, targetLang: string): boolean {
    if (!text || !text.trim()) return false;
    const sourceLang = detectSourceLangCode(text);
    if (sourceLang === 'ar' && (targetLang === 'fr' || targetLang === 'en')) {
      return true;
    }
    if (sourceLang === 'fr' && targetLang === 'ar') {
      return true;
    }
    return false;
  }

  useEffect(() => {
    // ━━ MANDAT 4P — TBT Fix C: Gate localeSeeded ━━
    // Sur une première visite (locale = 'fr' initialement), le seed locale
    // (fr→ar) déclenchait 16 appels /api/translate pour traduire les titres
    // arabes en français, puis re-rendait toute la grille quand la locale
    // passait à 'ar'. Le gate `localeSeeded` permet de skip la traduction
    // tant que la locale n'est pas stabilisée (seed terminé ou préférence
    // existante). Le visiteur FR de retour (locale stable 'fr') traduit
    // normalement — inchangé.
    if (typeof window !== 'undefined') {
      // Check if locale is still seeding (module-init 'fr' before DB seed)
      const stored = localStorage.getItem('abaya_clientLocale');
      const cookie = document.cookie.match(/abaya_locale=([^;]+)/);
      if (!stored && !cookie && targetLang === 'fr') {
        // First visit, locale not yet seeded → skip translation to avoid
        // the 16-call race that occurs when locale flips fr→ar post-seed
        setTranslated(text);
        return;
      }
    }

    // Pas de texte → rien à faire
    if (!text || !text.trim()) {
      setTranslated(text);
      return;
    }

    // Si ni le texte ni la langue n'ont changé → ne pas re-déclencher
    if (text === lastTextRef.current && targetLang === lastLangRef.current) {
      return;
    }

    lastTextRef.current = text;
    lastLangRef.current = targetLang;

    // DEBT-10 repair : détection intelligente au lieu du court-circuit 'fr' aveugle
    // Si le texte est déjà dans la même écriture que la langue cible, pas besoin de traduire
    if (!needsTranslation(text, targetLang)) {
      setTranslated(text);
      return;
    }

    // Vérifier le cache mémoire synchrone
    const cacheKey = `${CACHE_KEY_PREFIX}${targetLang}:${text.trim().toLowerCase()}`;
    const memCached = memoryCache.get(cacheKey);
    if (memCached) {
      setTranslated(memCached);
      return;
    }

    // Vérifier le cache localStorage synchrone
    const lsCached = readCache(cacheKey);
    if (lsCached) {
      memoryCache.set(cacheKey, lsCached);
      setTranslated(lsCached);
      return;
    }

    // Pas en cache → afficher le texte original immédiatement, puis déclencher la traduction
    setTranslated(text);

    let cancelled = false;
    fetchTranslation(text, targetLang).then((result) => {
      if (!cancelled && result !== text) {
        setTranslated(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [text, targetLang]);

  return translated;
}

/**
 * Version batch pour traduire plusieurs textes en parallèle (utile pour les listes de produits).
 * Évite les cascades de requêtes individuelles.
 */
export function useAutoTranslatedTexts(
  texts: string[],
  targetLang: string,
): string[] {
  const [translated, setTranslated] = useState<string[]>(texts);
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (texts.length === 0) {
      setTranslated([]);
      return;
    }

    const key = `${targetLang}:${texts.join('||')}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    if (targetLang === 'fr') {
      setTranslated(texts);
      return;
    }

    let cancelled = false;
    Promise.all(texts.map((t) => fetchTranslation(t, targetLang))).then((results) => {
      if (!cancelled) setTranslated(results);
    });

    return () => {
      cancelled = true;
    };
  }, [targetLang, texts.join('||')]);

  return translated;
}
