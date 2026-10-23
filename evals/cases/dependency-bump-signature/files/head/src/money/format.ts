/**
 * Formats an amount in minor units in the given ISO 4217 currency,
 * e.g. formatPrice(1999, "EUR", "de-DE") → "19,99 €".
 */
export function formatPrice(cents: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}
