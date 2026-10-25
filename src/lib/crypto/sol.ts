/**
 * Solana (SOL) – nur öffentliche Adresse (Base58 eines 32-Byte-Ed25519-Schlüssels, 32–44 Zeichen, ohne Prüfsumme).
 * Weil es keine Prüfsumme gibt, wird zusätzlich die Länge nach dem Dekodieren geprüft. Damit lässt sich nur ansehen.
 */
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58len(s: string): number | null {
  let n = 0n;
  for (const ch of s) { const i = B58.indexOf(ch); if (i < 0) return null; n = n * 58n + BigInt(i); }
  let bytes = 0;
  while (n > 0n) { bytes++; n >>= 8n; }
  for (const ch of s) { if (ch !== '1') break; bytes++; }
  return bytes;
}

export function isSolAddress(addr: string): boolean {
  const a = addr.trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) && b58len(a) === 32;
}

export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Bekannte SPL-Tokens: price 'usd' = Stablecoin, sonst Kurs-Kürzel */
export const SOL_TOKENS: Record<string, { symbol: string; price: 'usd' | 'render' }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', price: 'usd' },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', price: 'usd' },
  rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof: { symbol: 'RENDER', price: 'render' },
};
