import { createHash } from 'node:crypto';

/**
 * XRP Ledger – nur öffentliche Daten. Eine „klassische Adresse“ (r…) ist wie eine Kontonummer:
 * Man kann damit Kontostand und Bewegungen ansehen, aber nichts versenden (dafür bräuchte es den
 * privaten Schlüssel, der den Ledger nie verlässt).
 */

const ALPHABET = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz'; // XRPL-Base58
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest();

function decodeBase58(s: string): Buffer | null {
  let n = 0n;
  for (const ch of s) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const body = n === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  const lead = s.match(/^r*/)?.[0].length ?? 0; // 'r' steht für Null-Byte
  return Buffer.concat([Buffer.alloc(lead), body]);
}

/** Prüft Format UND Prüfsumme – ein Tippfehler fällt so sofort auf. */
export function isXrpAddress(addr: string): boolean {
  const a = addr.trim();
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(a)) return false;
  const raw = decodeBase58(a);
  if (!raw || raw.length !== 25 || raw[0] !== 0x00) return false;
  const check = sha256(sha256(raw.subarray(0, 21))).subarray(0, 4);
  return check.equals(raw.subarray(21));
}

/** Häufige Verwechslung: X-Adresse (X…) oder Adresse mit Destination Tag (Börsen). */
export function addressHint(addr: string): string | null {
  const a = addr.trim();
  if (/^X[1-9A-HJ-NP-Za-km-z]{40,50}$/.test(a)) return 'Das ist eine X-Adresse. Bitte in Ledger Live die klassische Adresse (beginnt mit „r“) kopieren.';
  if (/[?:]/.test(a) || /tag/i.test(a)) return 'Bitte nur die Adresse ohne Destination Tag einfügen.';
  if (/^r/.test(a) && a.length >= 25) return 'Die Adresse ist nicht gültig (Prüfsumme stimmt nicht) – vermutlich ein Tippfehler. Am besten direkt aus Ledger Live kopieren.';
  return null;
}

export const RIPPLE_EPOCH = 946_684_800; // 01.01.2000 in Unix-Sekunden
export const DROPS_PER_XRP = 1_000_000;

export interface XrpMove { hash: string; date: Date; direction: 'in' | 'out' | 'self' | 'other'; xrp: number | null; counterparty: string | null; type: string; fee: number }

/** account_tx-Eintrag → Bewegung aus Sicht der eigenen Adresse (nur XRP-Beträge; Tokens als „other“). */
export function toMove(own: string, tx: Record<string, unknown>, meta: Record<string, unknown> | undefined): XrpMove {
  const type = String(tx.TransactionType ?? '');
  const from = String(tx.Account ?? '');
  const to = typeof tx.Destination === 'string' ? tx.Destination : null;
  const delivered = meta?.delivered_amount ?? tx.DeliverMax ?? tx.Amount;
  const xrp = typeof delivered === 'string' && /^\d+$/.test(delivered) ? Number(delivered) / DROPS_PER_XRP : null;
  const direction = type !== 'Payment' ? 'other' : from === own && to === own ? 'self' : from === own ? 'out' : to === own ? 'in' : 'other';
  const date = typeof tx.date === 'number' ? new Date((tx.date + RIPPLE_EPOCH) * 1000) : new Date(0);
  const fee = from === own && typeof tx.Fee === 'string' ? Number(tx.Fee) / DROPS_PER_XRP : 0;
  return { hash: String(tx.hash ?? ''), date, direction, xrp, counterparty: direction === 'in' ? from : direction === 'out' ? to : null, type, fee };
}
