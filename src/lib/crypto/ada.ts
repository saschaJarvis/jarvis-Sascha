/**
 * Cardano – nur öffentliche Adresse (addr1…). Aus einer Basisadresse lässt sich die Stake-Adresse
 * (stake1…) ableiten; darüber liest Jarvis das GANZE Konto (alle Adressen + Staking-Belohnungen).
 * Auch damit kann nichts versendet werden.
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

function convertBits(data: number[], from: number, to: number, pad: boolean): number[] | null {
  let acc = 0, bits = 0; const out: number[] = []; const max = (1 << to) - 1;
  for (const v of data) {
    if (v < 0 || v >> from) return null;
    acc = (acc << from) | v; bits += from;
    while (bits >= to) { bits -= to; out.push((acc >> bits) & max); }
  }
  if (pad) { if (bits) out.push((acc << (to - bits)) & max); }
  else if (bits >= from || ((acc << (to - bits)) & max)) return null;
  return out;
}

/** Bech32 (ohne Längenbegrenzung, wie bei Cardano) → hrp + Bytes, oder null bei falscher Prüfsumme */
export function bech32Decode(s: string): { hrp: string; bytes: Uint8Array } | null {
  if (s !== s.toLowerCase() && s !== s.toUpperCase()) return null;
  const a = s.toLowerCase();
  const pos = a.lastIndexOf('1');
  if (pos < 1 || pos + 7 > a.length) return null;
  const hrp = a.slice(0, pos);
  const data = [...a.slice(pos + 1)].map((c) => CHARSET.indexOf(c));
  if (data.some((d) => d < 0)) return null;
  if (polymod([...hrpExpand(hrp), ...data]) !== 1) return null;
  const bytes = convertBits(data.slice(0, -6), 5, 8, false);
  return bytes ? { hrp, bytes: Uint8Array.from(bytes) } : null;
}

export function bech32Encode(hrp: string, bytes: Uint8Array): string {
  const data = convertBits([...bytes], 8, 5, true)!;
  const pm = polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1;
  const check = Array.from({ length: 6 }, (_, i) => (pm >> (5 * (5 - i))) & 31);
  return `${hrp}1${[...data, ...check].map((d) => CHARSET[d]).join('')}`;
}

/** Gültige Mainnet-Zahlungsadresse (Shelley addr1…) mit Prüfsumme */
export function isAdaAddress(addr: string): boolean {
  const d = bech32Decode(addr.trim());
  if (!d || d.hrp !== 'addr') return false;
  const header = d.bytes[0];
  const type = header >> 4, net = header & 0x0f;
  if (net !== 1) return false;                                   // 1 = Mainnet
  if (type <= 3) return d.bytes.length === 57;                   // Basisadresse: Zahlung + Stake
  if (type === 4) return d.bytes.length > 29;                    // Pointer
  if (type === 6 || type === 7) return d.bytes.length === 29;    // Enterprise (ohne Stake)
  return false;
}

/** Stake-Adresse (stake1…) aus einer Basisadresse, sonst null */
export function stakeAddressOf(addr: string): string | null {
  const d = bech32Decode(addr.trim());
  if (!d || d.hrp !== 'addr' || d.bytes.length !== 57) return null;
  const type = d.bytes[0] >> 4, net = d.bytes[0] & 0x0f;
  if (type > 3) return null;
  const scriptStake = type === 2 || type === 3;
  const header = (scriptStake ? 0xf0 : 0xe0) | net;
  return bech32Encode('stake', Uint8Array.from([header, ...d.bytes.slice(29)]));
}

export function adaAddressHint(addr: string): string | null {
  const a = addr.trim();
  if (/^stake1/.test(a)) return 'Das ist eine Stake-Adresse. Bitte die Empfangsadresse (beginnt mit „addr1“) aus Ledger Live einfügen.';
  if (/^addr_test1/.test(a)) return 'Das ist eine Testnet-Adresse. Bitte die normale Cardano-Adresse verwenden.';
  if (/^(Ae2|DdzFF)/.test(a)) return 'Das ist eine alte Byron-Adresse. Bitte eine aktuelle Adresse (addr1…) aus Ledger Live verwenden.';
  if (/^addr1/i.test(a)) return 'Die Cardano-Adresse ist nicht gültig (Prüfsumme stimmt nicht) – vermutlich ein Tippfehler. Am besten direkt aus Ledger Live kopieren.';
  return null;
}

export const LOVELACE_PER_ADA = 1_000_000;
