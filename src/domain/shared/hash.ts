const OFFSET_BASIS = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

const utf8 = new TextEncoder();

/**
 * FNV-1a 64-bit over the UTF-8 bytes of `input`, as 16 lowercase hex chars.
 * Not cryptographic: it names things stably (hunks, analyses), it doesn't protect them.
 */
export const fnv1a64 = (input: string): string => {
  let hash = OFFSET_BASIS;
  for (const byte of utf8.encode(input)) {
    hash = ((hash ^ BigInt(byte)) * PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, "0");
};
