/**
 * MANDAT 4P — RECTIFICATIONS AUDIT 360° (P0 Build TypeScript)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Helper de typage Prisma JSON — assainissement de la baseline tsc.
 *
 * Constat : ~20 erreurs TS2322 « Type 'Record<string, unknown>' is not
 * assignable to 'NullableJsonNullValueInput | InputJsonValue | undefined' »
 * dans les routes API. Les valeurs proviennent TOUJOURS de sources
 * JSON-sûres par construction (JSON.parse de corps de requête, données de
 * sheets, objets littéraux) — l'invariant runtime est déjà respecté, seul le
 * typage manquait. Ce helper documente et centralise ce narrowing.
 *
 * Zéro changement runtime : la valeur est retournée telle quelle (pas de
 * clonage, pas de sérialisation) — c'est un narrowing de type pur.
 */

import { Prisma } from '@prisma/client';

/**
 * Narrow un enregistrement JSON-safe runtime vers Prisma.InputJsonObject.
 * À utiliser à chaque frontière Prisma où une valeur dynamique (provenant
 * de JSON.parse / corps de requête) alimente un champ Json.
 */
export function toPrismaJson(
  value: Record<string, unknown> | { [key: string]: unknown } | null | undefined
): Prisma.InputJsonObject | undefined {
  if (value === null || value === undefined) return undefined;
  return value as Prisma.InputJsonObject;
}
