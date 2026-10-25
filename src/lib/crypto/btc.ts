import { createHash } from 'node:crypto';

/**
 * Bitcoin – nur öffentliche Adresse. Unterstützt: Legacy (1…), P2SH (3…), SegWit (bc1q…), Taproot (bc1p…).
 * Prüfsummen: Base58Check bzw. Bech32/Bech32m – Tippfehler fallen sofort auf.
 */

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest();

export function base58check(addr: string, size = 25): Buffer | null {
  let n = 0n;
  for (const ch of addr) {
    const i = B58.indexOf(ch);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const lead = addr.match(/^1*/)?.[0].length ?? 0;
  const raw = Buffer.concat([Buffer.alloc(lead), n === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex')]);
  if (raw.length !== size) return null;
  const ok = sha256(sha256(raw.subarray(0, size - 4))).subarray(0, 4).equals(raw.subarray(size - 4));
  return ok ? raw : null;
}

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

export function segwitValid(addr: string, hrp = 'bc'): boolean {
  const a = addr.toLowerCase();
  if (addr !== a && addr !== addr.toUpperCase()) return false; // gemischte Schreibweise unzulässig
  const pos = a.lastIndexOf('1');
  if (a.slice(0, pos) !== hrp || a.length < 14 || a.length > 90) return false;
  const data = [...a.slice(pos + 1)].map((c) => CHARSET.indexOf(c));
  if (data.some((d) => d < 0) || data.length < 7) return false;
  const pm = polymod([...hrpExpand(hrp), ...data]);
  const version = data[0];
  const expected = version === 0 ? 1 : 0x2bc830a3; // Bech32 für v0, Bech32m ab v1 (BIP-350)
  if (pm !== expected || version > 16) return false;
  // Programmlänge: 5-Bit → 8-Bit
  const prog = data.slice(1, -6);
  let acc = 0, bits = 0; const out: number[] = [];
  for (const v of prog) { acc = (acc << 5) | v; bits += 5; while (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); } }
  if (bits >= 5 || ((acc << (8 - bits)) & 0xff)) return false;
  if (out.length < 2 || out.length > 40) return false;
  if (version === 0 && out.length !== 20 && out.length !== 32) return false;
  return true;
}

export function isBtcAddress(addr: string): boolean {
  const a = addr.trim();
  if (/^bc1/i.test(a)) return segwitValid(a);
  if (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(a)) {
    const raw = base58check(a);
    return !!raw && ((a[0] === '1' && raw[0] === 0x00) || (a[0] === '3' && raw[0] === 0x05));
  }
  return false;
}

export function btcAddressHint(addr: string): string | null {
  const a = addr.trim();
  if (/^[xyz]pub/i.test(a)) return 'Der Kontoschlüssel (xpub/ypub/zpub) ist nicht gültig – bitte vollständig aus Ledger Live kopieren oder den ganzen Export einfügen.';
  if (/^(tb1|[mn2])/.test(a)) return 'Das ist eine Testnet-Adresse. Bitte die normale Bitcoin-Adresse verwenden.';
  if (/^(1|3|bc1)/i.test(a)) return 'Die Bitcoin-Adresse ist nicht gültig (Prüfsumme stimmt nicht) – vermutlich ein Tippfehler. Am besten direkt aus Ledger Live kopieren.';
  return null;
}

export const SATS_PER_BTC = 100_000_000;
