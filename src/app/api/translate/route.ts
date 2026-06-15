import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// Simple in-memory cache to avoid re-translating the same text
const translationCache = new Map<string, Record<string, string>>();

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

    // Default: translate from French to Arabic and English
    const source = sourceLang || 'fr';
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

    // Build the target language list for the prompt
    const targetLabels: Record<string, string> = {
      fr: 'French',
      en: 'English',
      ar: 'Arabic',
    };
    const targetList = targets.map(l => `${l} (${targetLabels[l] || l})`).join(', ');

    const zai = await ZAI.create();
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

    const content = response.choices?.[0]?.message?.content || '';

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

    // Ensure source language is included
    translations[source] = text.trim();

    // Cache the result
    translationCache.set(cacheKey, translations);

    // Limit cache size
    if (translationCache.size > 500) {
      const firstKey = translationCache.keys().next().value;
      if (firstKey) translationCache.delete(firstKey);
    }

    return NextResponse.json({ data: translations });
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
