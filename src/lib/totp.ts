/**
 * TOTP nach RFC 6238 (HMAC-SHA1, 30 s, 6 Ziffern) – kompatibel mit gängigen Authenticator-Apps.
 * Nur Node (node:crypto). Replay-Schutz: Aufrufer speichert den zuletzt akzeptierten Zähler.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = B32.indexOf(ch);
    if (i < 0) throw new Error('Ungültiges Base32');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: bigint, digits = 6, algo: 'sha1' | 'sha256' | 'sha512' = 'sha1'): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(counter);
  const h = createHmac(algo, secret).update(msg).digest();
  const off = h[h.length - 1] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export function counterAt(unixMs: number, step = 30): bigint {
  return BigInt(Math.floor(unixMs / 1000 / step));
}

/** Prüft Code im Fenster ±window Schritte. Liefert den akzeptierten Zähler oder null. */
export function verifyTotp(secretB32: string, code: string, nowMs: number, opts: { window?: number; lastCounter?: bigint | null } = {}): bigint | null {
  const c = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const secret = base32Decode(secretB32);
  const now = counterAt(nowMs);
  const w = BigInt(opts.window ?? 1);
  for (let i = -w; i <= w; i++) {
    const ctr = now + i;
    if (opts.lastCounter != null && ctr <= opts.lastCounter) continue; // Replay
    const expected = Buffer.from(hotp(secret, ctr));
    if (timingSafeEqual(expected, Buffer.from(c))) return ctr;
  }
  return null;
}

export function otpauthUri(secretB32: string, account: string, issuer = 'Jarvis'): string {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
