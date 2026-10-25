import { blake2b } from '@noble/hashes/blake2b';

/**
 * Polkadot (DOT) – nur öffentliche Adresse (SS58, Netz-Präfix 0, beginnt mit „1“, 47–48 Zeichen).
 * Aufbau: Präfix-Byte + 32-Byte-Schlüssel + 2 Byte Prüfsumme = blake2b-512("SS58PRE" ‖ Präfix ‖ Schlüssel)[0..2].
 * Damit lässt sich nur ansehen, nichts versenden.
 */
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58decode(s: string): Uint8Array | null {
  let n = 0n;
  for (const ch of s) { const i = B58.indexOf(ch); if (i < 0) return null; n = n * 58n + BigInt(i); }
  const bytes: number[] = [];
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
  for (const ch of s) { if (ch !== '1') break; bytes.unshift(0); }
  return Uint8Array.from(bytes);
}

/** 32-Byte-Kontoschlüssel aus einer Polkadot-Adresse, sonst null */
export function dotPublicKey(addr: string): Uint8Array | null {
  const a = addr.trim();
  if (!/^1[1-9A-HJ-NP-Za-km-z]{46,47}$/.test(a)) return null;
  const raw = b58decode(a);
  if (!raw || raw.length !== 35 || raw[0] !== 0) return null;
  const pre = new TextEncoder().encode('SS58PRE');
  const h = blake2b(Uint8Array.from([...pre, ...raw.subarray(0, 33)]), { dkLen: 64 });
  if (h[0] !== raw[33] || h[1] !== raw[34]) return null;
  return raw.subarray(1, 33);
}

export const isDotAddress = (addr: string) => dotPublicKey(addr) !== null;

export function dotAddressHint(addr: string): string | null {
  const a = addr.trim();
  if (/^[1-9A-HJ-NP-Za-km-z]{47,48}$/.test(a) && !a.startsWith('1')) return 'Das sieht nach einer Adresse aus einem anderen Polkadot-Netz aus (z. B. Kusama oder generisches Format). Bitte die Polkadot-Adresse (beginnt mit 1) aus Ledger Live nehmen.';
  if (/^1[1-9A-HJ-NP-Za-km-z]{44,49}$/.test(a)) return 'Die Polkadot-Adresse ist nicht gültig (Prüfsumme stimmt nicht) – vermutlich ein Tippfehler. Am besten direkt aus Ledger Live kopieren.';
  return null;
}

export const PLANCK_PER_DOT = 10_000_000_000;

// ---------- Speicher-Schlüssel für System.Account (Substrate) ----------
// twox128 = zwei xxHash64 (Seed 0 und 1), little-endian aneinandergehängt
const P1 = 0x9E3779B185EBCA87n, P2 = 0xC2B2AE3D27D4EB4Fn, P3 = 0x165667B19E3779F9n, P4 = 0x85EBCA77C2B2AE63n, P5 = 0x27D4EB2F165667C5n;
const M = (1n << 64n) - 1n;
const rotl = (x: bigint, r: bigint) => ((x << r) | (x >> (64n - r))) & M;
const round = (acc: bigint, lane: bigint) => (rotl((acc + lane * P2) & M, 31n) * P1) & M;
const merge = (acc: bigint, v: bigint) => (((acc ^ round(0n, v)) * P1) & M) + P4 & M;
const u64 = (b: Uint8Array, o: number) => { let v = 0n; for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[o + i]); return v; };
const u32 = (b: Uint8Array, o: number) => BigInt(b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + (BigInt(b[o + 3]) << 24n);

export function xxhash64(data: Uint8Array, seed: bigint): bigint {
  const len = data.length;
  let p = 0, h: bigint;
  if (len >= 32) {
    let v1 = (seed + P1 + P2) & M, v2 = (seed + P2) & M, v3 = seed, v4 = (seed - P1) & M;
    while (p + 32 <= len) { v1 = round(v1, u64(data, p)); v2 = round(v2, u64(data, p + 8)); v3 = round(v3, u64(data, p + 16)); v4 = round(v4, u64(data, p + 24)); p += 32; }
    h = (rotl(v1, 1n) + rotl(v2, 7n) + rotl(v3, 12n) + rotl(v4, 18n)) & M;
    h = merge(h, v1); h = merge(h, v2); h = merge(h, v3); h = merge(h, v4);
  } else h = (seed + P5) & M;
  h = (h + BigInt(len)) & M;
  while (p + 8 <= len) { h = (rotl(h ^ round(0n, u64(data, p)), 27n) * P1 + P4) & M; p += 8; }
  if (p + 4 <= len) { h = (rotl(h ^ ((u32(data, p) * P1) & M), 23n) * P2 + P3) & M; p += 4; }
  while (p < len) { h = (rotl(h ^ ((BigInt(data[p]) * P5) & M), 11n) * P1) & M; p++; }
  h ^= h >> 33n; h = (h * P2) & M; h ^= h >> 29n; h = (h * P3) & M; h ^= h >> 32n;
  return h;
}

const le64 = (v: bigint) => { const out: number[] = []; for (let i = 0; i < 8; i++) { out.push(Number(v & 0xffn)); v >>= 8n; } return out; };
const hex = (b: ArrayLike<number>) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const twox128 = (s: string) => { const d = new TextEncoder().encode(s); return [...le64(xxhash64(d, 0n)), ...le64(xxhash64(d, 1n))]; };

/** Speicherschlüssel System.Account(konto) = twox128("System") ‖ twox128("Account") ‖ blake2_128(konto) ‖ konto */
export function systemAccountKey(pub: Uint8Array): string {
  return `0x${hex(twox128('System'))}${hex(twox128('Account'))}${hex(blake2b(pub, { dkLen: 16 }))}${hex(pub)}`;
}

/** AccountInfo (SCALE): nonce u32, consumers u32, providers u32, sufficients u32, free u128, reserved u128, frozen u128, flags u128 */
export function decodeAccountInfo(hexData: string | null): { free: bigint; reserved: bigint; frozen: bigint } {
  if (!hexData) return { free: 0n, reserved: 0n, frozen: 0n };
  const b = hexData.replace(/^0x/, '');
  const u128 = (off: number) => { let v = 0n; for (let i = 15; i >= 0; i--) v = (v << 8n) | BigInt(parseInt(b.slice((off + i) * 2, (off + i) * 2 + 2), 16)); return v; };
  return { free: u128(16), reserved: u128(32), frozen: u128(48) };
}
