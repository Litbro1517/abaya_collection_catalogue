/**
 * Generate a URL-safe slug from a name string.
 * Converts to lowercase, replaces spaces/special chars with hyphens,
 * removes non-alphanumeric chars, and appends a short random suffix if needed.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Generate a unique slug by appending a random suffix if the base slug is taken.
 */
export function generateUniqueSlug(
  name: string,
  existingSlugs: string[]
): string {
  let slug = generateSlug(name)
  if (!existingSlugs.includes(slug)) return slug

  const suffix = Math.random().toString(36).substring(2, 6)
  slug = `${slug}-${suffix}`
  return slug
}

/**
 * Valid column types for the DataSource schema
 */
export const VALID_COLUMN_TYPES = [
  'TEXT',
  'NUMBER',
  'CURRENCY',
  'IMAGE',
  'IMAGE_ARRAY',
  'SELECT',
  'MULTI_SELECT',
  'RELATION',
  'ARRAY',
  'BOOLEAN',
  'URL',
  'STATUS',
] as const

export type ColumnType = (typeof VALID_COLUMN_TYPES)[number]

/**
 * Validate that a column type is allowed
 */
export function isValidColumnType(type: string): type is ColumnType {
  return VALID_COLUMN_TYPES.includes(type as ColumnType)
}
