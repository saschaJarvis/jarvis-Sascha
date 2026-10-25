/**
 * Cosmos Hub (ATOM) – nur öffentliche Adresse „cosmos1…“ (Bech32, 20-Byte-Konto).
 * Prüfsumme: Bech32 (BIP-173). Damit lässt sich nur ansehen, nichts versenden.
 */

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}
const hrpExpand = (hrp: string) => [...[...hrp].map((c) => c.charCodeAt(0) >> 5), 0, ...[...hrp].map((c) => c.charCodeAt(0) & 31)];

export function isAtomAddress(addr: string): boolean {
  const a = addr.trim();
  if (!/^cosmos1[02-9ac-hj-np-z]{38}$/.test(a)) return false; // 20 Byte = 32 Zeichen + 6 Prüfzeichen
  const data = [...a.slice(7)].map((c) => CHARSET.indexOf(c));
  if (polymod([...hrpExpand('cosmos'), ...data]) !== 1) return false;
  // 5-Bit → 8-Bit: genau 20 Byte, Füllbits 0
  let acc = 0, bits = 0, n = 0;
  for (const v of data.slice(0, -6)) { acc = ((acc << 5) | v) & 0xfff; bits += 5; while (bits >= 8) { bits -= 8; n++; } }
  return n === 20 && bits < 5 && (acc & ((1 << bits) - 1)) === 0;
}

export function atomAddressHint(addr: string): string | null {
  const a = addr.trim();
  if (/^cosmosvaloper1/.test(a)) return 'Das ist die Adresse eines Validators, nicht deine. Bitte deine Konto-Adresse (beginnt mit cosmos1) aus Ledger Live nehmen.';
  if (/^COSMOS1/.test(a)) return 'Cosmos-Adressen bitte in Kleinbuchstaben – am besten direkt aus Ledger Live kopieren.';
  if (/^cosmos1/.test(a)) return 'Die Cosmos-Adresse ist nicht gültig (Prüfsumme stimmt nicht) – vermutlich ein Tippfehler. Am besten direkt aus Ledger Live kopieren.';
  return null;
}

export const UATOM_PER_ATOM = 1_000_000;
