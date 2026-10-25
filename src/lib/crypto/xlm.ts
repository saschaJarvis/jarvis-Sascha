/**
 * Stellar (XLM) – nur öffentliches Konto „G…“ (StrKey: Base32, 56 Zeichen).
 * Aufbau: 1 Versionsbyte (6 << 3 = Konto) + 32 Byte Ed25519-Schlüssel + 2 Byte CRC16-XModem (little-endian).
 * Damit lässt sich nur ansehen, nichts versenden. Geheime Schlüssel beginnen mit „S“ und werden abgewiesen.
 */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32(s: string): Uint8Array | null {
  let bits = 0, acc = 0; const out: number[] = [];
  for (const ch of s) {
    const i = B32.indexOf(ch);
    if (i < 0) return null;
    acc = (acc << 5) | i; bits += 5;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
  }
  if (bits > 0 && (acc & ((1 << bits) - 1)) !== 0) return null; // Füllbits müssen 0 sein
  return Uint8Array.from(out);
}

function crc16xmodem(data: Uint8Array): number {
  let crc = 0;
  for (const b of data) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

export function isXlmAddress(addr: string): boolean {
  const a = addr.trim();
  if (!/^G[A-Z2-7]{55}$/.test(a)) return false;
  const raw = base32(a);
  if (!raw || raw.length !== 35 || raw[0] !== 6 << 3) return false;
  const crc = crc16xmodem(raw.subarray(0, 33));
  return raw[33] === (crc & 0xff) && raw[34] === crc >> 8;
}

export function xlmAddressHint(addr: string): string | null {
  const a = addr.trim();
  if (/^S[A-Z2-7]{55}$/.test(a)) return null; // geheimer Schlüssel – wird vorher als Geheimnis abgewiesen
  if (/^M[A-Z2-7]{68}$/.test(a)) return 'Das ist eine Stellar-Unterkonto-Adresse (M…). Bitte die normale Konto-Adresse (beginnt mit G) aus Ledger Live nehmen.';
  if (/^g[a-z2-7]{55}$/.test(a)) return 'Stellar-Adressen bestehen aus GROSSBUCHSTABEN – bitte direkt aus Ledger Live kopieren.';
  if (/^G[A-Z2-7]{50,60}$/.test(a)) return 'Die Stellar-Adresse ist nicht gültig (Prüfsumme stimmt nicht) – vermutlich ein Tippfehler. Am besten direkt aus Ledger Live kopieren.';
  return null;
}

/** Stellar-Stablecoins (Asset-Code + Herausgeber): 1 Token ≈ 1 USD */
export const XLM_STABLES: Record<string, string> = {
  'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN': 'USDC', // Circle
};
