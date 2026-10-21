const ESCAPES: Readonly<Record<string, number>> = {
  a: 0x07,
  b: 0x08,
  t: 0x09,
  n: 0x0a,
  v: 0x0b,
  f: 0x0c,
  r: 0x0d,
  '"': 0x22,
  "\\": 0x5c,
};

const utf8 = new TextEncoder();
const utf8Decoder = new TextDecoder();

/**
 * Reads a C-style quoted string at the start of `text`, as git writes paths with special
 * characters: `"a/with space\tand \303\251"`. Octal escapes are UTF-8 bytes. Returns the
 * unquoted value and whatever follows the closing quote, or null if it isn't a valid quoted string.
 */
export const readCString = (text: string): { value: string; rest: string } | null => {
  if (!text.startsWith('"')) return null;
  const bytes: number[] = [];
  let index = 1;
  while (index < text.length) {
    const char = text.charAt(index);
    if (char === '"') {
      return { value: utf8Decoder.decode(new Uint8Array(bytes)), rest: text.slice(index + 1) };
    }
    if (char !== "\\") {
      const codePoint = text.codePointAt(index) ?? 0;
      const literal = String.fromCodePoint(codePoint);
      bytes.push(...utf8.encode(literal));
      index += literal.length;
      continue;
    }
    const octal = /^[0-3][0-7]{2}/.exec(text.slice(index + 1));
    if (octal !== null) {
      bytes.push(Number.parseInt(octal[0], 8));
      index += 4;
      continue;
    }
    const escaped = ESCAPES[text.charAt(index + 1)];
    if (escaped === undefined) return null;
    bytes.push(escaped);
    index += 2;
  }
  return null;
};
