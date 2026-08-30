import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Simple in-memory cache to avoid re-translating the same text
const translationCache = new Map<string, Record<string, string>>();

// ━━ Fix: track SDK availability so we don't retry ZAI.create() on every request ━━
// In production (Vercel), the .z-ai-config file doesn't exist → ZAI.create() throws.
// Once we detect this, we skip the SDK entirely and return the original text (200 OK).
let sdkAvailable: boolean | null = null;

// ━━ DEBT-10 production repair : détection automatique de la langue source ━━
function detectSourceLang(text: string): string {
  if (!text || typeof text !== 'string') return 'fr';
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  return arabicChars > latinChars * 0.5 ? 'ar' : 'fr';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, sourceLang, targetLangs } = body as {
      text: string;
      sourceLang?: string;
      targetLangs?: string[];
    };

    if (!text || typeof text !== 'string' || text.trim() === '') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // DEBT-10 production repair : détection automatique si sourceLang absent
    const source = (sourceLang && ['fr', 'en', 'ar'].includes(sourceLang))
      ? sourceLang
      : detectSourceLang(text);
    const targets = targetLangs || ['ar', 'en'];

    // Check cache
    const cacheKey = `${source}:${text.trim().toLowerCase()}`;
    const cached = translationCache.get(cacheKey);
    if (cached) {
      // Only return the requested target languages
      const filtered: Record<string, string> = { [source]: text.trim() };
      for (const lang of targets) {
        if (cached[lang]) filtered[lang] = cached[lang];
      }
      return NextResponse.json({ data: filtered });
    }

    // ━━ Fix: defensive SDK check — skip if SDK is known unavailable ━━
    // In production without .z-ai-config, ZAI.create() throws. We catch this
    // once, set sdkAvailable=false, and return the original text with 200 OK
    // so the front-end gets a clean fallback (no HTTP 500 in the console).
    if (sdkAvailable === false) {
      const fallback: Record<string, string> = { [source]: text.trim() };
      for (const lang of targets) {
        if (lang !== source) fallback[lang] = text.trim();
      }
      return NextResponse.json({ data: fallback, translated: false });
    }

    // Build the target language list for the prompt
    const targetLabels: Record<string, string> = {
      fr: 'French',
      en: 'English',
      ar: 'Arabic',
    };
    const targetList = targets.map(l => `${l} (${targetLabels[l] || l})`).join(', ');

    // ━━ Fix: try/catch around ZAI.create() — catch config errors gracefully ━━
    // Typage : la classe ZAI a un constructeur privé → InstanceType<typeof ZAI>
    // est invalide (TS2344) ; Awaited<ReturnType<typeof ZAI.create>> résout ZAI.
    let zai: Awaited<ReturnType<typeof ZAI.create>>;
    try {
      zai = await ZAI.create();
      sdkAvailable = true;
    } catch (sdkError) {
      // SDK config not available (missing .z-ai-config file in production)
      console.warn('[translate] ZAI SDK unavailable, returning original text:', sdkError instanceof Error ? sdkError.message : String(sdkError));
      sdkAvailable = false;
      const fallback: Record<string, string> = { [source]: text.trim() };
      for (const lang of targets) {
        if (lang !== source) fallback[lang] = text.trim();
      }
      return NextResponse.json({ data: fallback, translated: false });
    }

    // ━━ Fix: try/catch around the chat completion API call ━━
    let content = '';
    try {
      const response = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `You are a professional translator for an e-commerce fashion catalog specializing in modest clothing (abayas, dresses, ensembles, kimonos). Translate the given text accurately and naturally. Respond ONLY with a valid JSON object where keys are language codes and values are translations. No explanation, no markdown, no backticks. Example: {"fr": "Ensemble", "ar": "طقم", "en": "Set"}`,
          },
          {
            role: 'user',
            content: `Translate "${text.trim()}" from ${targetLabels[source] || source} to: ${targetList}. Return JSON with keys: ${source}, ${targets.join(', ')}`,
          },
        ],
      });
      content = response.choices?.[0]?.message?.content || '';
    } catch (apiError) {
      // Network error, quota exceeded, or API authentication failure
      console.warn('[translate] ZAI API call failed, returning original text:', apiError instanceof Error ? apiError.message : String(apiError));
      const fallback: Record<string, string> = { [source]: text.trim() };
      for (const lang of targets) {
        if (lang !== source) fallback[lang] = text.trim();
      }
      return NextResponse.json({ data: fallback, translated: false });
    }

    // Parse the JSON response — try to extract JSON even if wrapped in backticks
    let translations: Record<string, string> = {};
    try {
      // Try direct parse first
      translations = JSON.parse(content);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          translations = JSON.parse(jsonMatch[1].trim());
        } catch {
          // Fallback: return original text for all languages
        }
      }
    }

    // DEBT-10 production repair : conditionnel au lieu d'écrasement systématique
    if (!translations[source]) {
      translations[source] = text.trim();
    }

    // Cache the result
    translationCache.set(cacheKey, translations);

    // Limit cache size
    if (translationCache.size > 500) {
      const firstKey = translationCache.keys().next().value;
      if (firstKey) translationCache.delete(firstKey);
    }

    return NextResponse.json({ data: translations });
  } catch (error) {
    // ━━ Fix: never return 500 — always return original text with 200 OK ━━
    // The front-end (useAutoTranslatedText) already handles the fallback gracefully.
    // A 500 error pollutes the browser console and fails ad platform audits.
    console.error('Translation API unexpected error:', error);
    try {
      const body = await req.json();
      const text = body?.text || '';
      const source = body?.sourceLang || detectSourceLang(text);
      const targets = body?.targetLangs || ['ar', 'en'];
      const fallback: Record<string, string> = { [source]: text.trim() };
      for (const lang of targets) {
        if (lang !== source) fallback[lang] = text.trim();
      }
      return NextResponse.json({ data: fallback, translated: false });
    } catch {
      return NextResponse.json({ data: {}, translated: false });
    }
  }
}
