import { sha512_256 } from '@noble/hashes/sha512';

/**
 * Algorand – nur öffentliche Adresse (58 Zeichen, Base32). Prüfsumme: letzte 4 Bytes von SHA-512/256
 * über den 32-Byte-Schlüssel. Damit lässt sich nur ansehen, nichts versenden.
 */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(addr: string): Uint8Array | null {
  let bits = '';
  for (const ch of addr) { const i = B32.indexOf(ch); if (i < 0) return null; bits += i.toString(2).padStart(5, '0'); }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  if (/1/.test(bits.slice(out.length * 8))) return null; // Füllbits müssen 0 sein (eindeutige Schreibweise)
  return Uint8Array.from(out);
}

export function isAlgoAddress(addr: string): boolean {
  const a = addr.trim();
  if (!/^[A-Z2-7]{58}$/.test(a)) return false;
  const b = base32(a);
  if (!b || b.length !== 36) return false;
  const h = sha512_256(b.subarray(0, 32));
  return h.subarray(28).every((v, i) => v === b[32 + i]);
}

export function algoAddressHint(addr: string): string | null {
  const a = addr.trim();
  if (/^[a-z2-7]{58}$/.test(a)) return 'Algorand-Adressen bestehen aus GROSSBUCHSTABEN – bitte direkt aus Ledger Live kopieren.';
  if (/^[A-Z2-7]{50,70}$/.test(a)) return 'Die Algorand-Adresse ist nicht gültig (Prüfsumme stimmt nicht) – vermutlich ein Tippfehler. Am besten direkt aus Ledger Live kopieren.';
  return null;
}

export const MICRO_PER_ALGO = 1_000_000;
/** Bekannte Stablecoins (Algorand Standard Assets): 1 Token ≈ 1 USD */
export const ALGO_STABLES: Record<number, { symbol: string; decimals: number }> = {
  31566704: { symbol: 'USDC', decimals: 6 },
  312769: { symbol: 'USDT', decimals: 6 },
};
