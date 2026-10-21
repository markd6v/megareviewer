const TICKET_KEY = /\b[A-Z][A-Z0-9]+-\d+\b/g;

// Tokens that look like Jira keys but name standards and encodings.
const NOT_TICKETS = new Set(["UTF-8", "UTF-16", "SHA-1", "SHA-256", "SHA-512", "ISO-8601"]);
const NOT_TICKET_PREFIXES = ["RFC-", "CVE-"];
// In "X-FOO-1" the key would be FOO-1, but the token is header-like, not a ticket.
const AFTER_HEADER_PREFIX = /(^|[^A-Za-z0-9])[Xx]-$/;

const isTicketKey = (key: string, textBefore: string): boolean =>
  !NOT_TICKETS.has(key) &&
  !NOT_TICKET_PREFIXES.some((prefix) => key.startsWith(prefix)) &&
  !AFTER_HEADER_PREFIX.test(textBefore);

/** Jira-style ticket keys in the texts, unique, in first-seen order. */
export const extractTicketKeys = (texts: readonly string[]): string[] => {
  const keys = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(TICKET_KEY)) {
      const key = match[0];
      const textBefore = text.slice(Math.max(0, match.index - 3), match.index);
      if (isTicketKey(key, textBefore)) {
        keys.add(key);
      }
    }
  }
  return [...keys];
};
