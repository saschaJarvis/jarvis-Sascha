import { createHash } from 'node:crypto';

/**
 * Zcash – nur öffentliche, TRANSPARENTE Adresse (t1… / t3…). Base58Check mit 2-Byte-Präfix:
 * 0x1cb8 = t1 (P2PKH), 0x1cbd = t3 (P2SH). Damit lässt sich nur ansehen, nichts versenden.
 * Abgeschirmte Guthaben (z…/u…-Adressen, Sapling/Orchard) sind von außen grundsätzlich nicht sichtbar.
 */

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest();
const PREFIXES = ['1cb8', '1cbd'];

function decode(addr: string): Buffer | null {
  let n = 0n;
  for (const ch of addr) {
    const i = B58.indexOf(ch);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  return Buffer.from(hex, 'hex');
}

export function isZecAddress(addr: string): boolean {
  const a = addr.trim();
  if (!/^t[13][1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return false;
  const raw = decode(a);
  if (!raw || raw.length !== 26) return false;
  if (!PREFIXES.includes(raw.subarray(0, 2).toString('hex'))) return false;
  return sha256(sha256(raw.subarray(0, 22))).subarray(0, 4).equals(raw.subarray(22));
}

export function zecAddressHint(addr: string): string | null {
  const a = addr.trim();
  if (/^(zs1|zc|u1)/.test(a)) return 'Das ist eine abgeschirmte Zcash-Adresse (z…/u…). Deren Guthaben ist von außen nicht sichtbar – bitte die transparente Adresse (beginnt mit t1) aus Ledger Live nehmen.';
  if (/^t[13][1-9A-HJ-NP-Za-km-z]{30,36}$/.test(a)) return 'Die Zcash-Adresse ist nicht gültig (Prüfsumme stimmt nicht) – vermutlich ein Tippfehler. Am besten direkt aus Ledger Live kopieren.';
  return null;
}

export const ZAT_PER_ZEC = 100_000_000;
