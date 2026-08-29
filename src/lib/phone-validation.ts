/**
 * Lot 3 — Moroccan phone validation utility
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Validates Moroccan phone numbers in all common formats:
 *   - Mobile: 06XXXXXXXX, 07XXXXXXXX, 05XXXXXXXX (10 digits, leading 0)
 *   - International: +2126XXXXXXXX, +2127XXXXXXXX, +2125XXXXXXXX
 *   - International (alt): 002126XXXXXXXX, 002127XXXXXXXX, 002125XXXXXXXX
 *
 * The regex accepts the second digit being 5, 6, or 7 (Moroccan mobile + some
 * landline prefixes). Landline prefixes (05XX) are also accepted.
 *
 * Whitespace, dots, and hyphens are stripped before validation so users can
 * type "06 12 34 56 78" or "06.12.34.56.78" — both are valid.
 *
 * Replaces the previous loose check: `form.customerPhone.trim().length < 6`
 * which let through invalid/incomplete numbers like "12345" or "abcde".
 */

/**
 * Strip whitespace, dots, and hyphens from a phone number string.
 * Does NOT strip the leading + or 00 — those are part of the international format.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s.-]/g, '');
}

/**
 * Validate a Moroccan phone number.
 *
 * Accepted formats (after whitespace/dot/hyphen stripping):
 *   0612345678        (mobile, 0 prefix, 10 digits)
 *   0712345678        (mobile, 0 prefix, 10 digits)
 *   0512345678        (mobile/landline, 0 prefix, 10 digits)
 *   +212612345678     (international, +212 prefix, 12 digits after +)
 *   00212612345678    (international, 00212 prefix, 14 digits)
 *
 * Rejected:
 *   12345             (too short, wrong prefix)
 *   0812345678        (invalid prefix 08 — not a Moroccan mobile/landline)
 *   061234567         (only 9 digits after 0)
 *   abcde             (non-numeric)
 *
 * @returns true if the phone is a valid Moroccan format
 */
export function validateMoroccanPhone(phone: string): boolean {
  const cleaned = normalizePhone(phone);
  // Match: (+212 | 00212 | 0) followed by a digit 5-7, then exactly 8 more digits
  const moroccanPhoneRegex = /^(?:\+212|00212|0)[5-7]\d{8}$/;
  return moroccanPhoneRegex.test(cleaned);
}
