import { base58check, segwitValid } from './btc';

/**
 * Litecoin – nur öffentliche Adresse. Unterstützt: Legacy (L…, Version 0x30), P2SH (M…, Version 0x32),
 * SegWit (ltc1…, Bech32/Bech32m). Alte P2SH-Adressen mit „3“ sind von Bitcoin nicht unterscheidbar und
 * werden hier nicht angenommen (Ledger Live zeigt M… oder ltc1…).
 */
export function isLtcAddress(addr: string): boolean {
  const a = addr.trim();
  if (/^ltc1/i.test(a)) return segwitValid(a, 'ltc');
  if (/^[LM][1-9A-HJ-NP-Za-km-z]{26,33}$/.test(a)) {
    const raw = base58check(a);
    return !!raw && ((a[0] === 'L' && raw[0] === 0x30) || (a[0] === 'M' && raw[0] === 0x32));
  }
  return false;
}

export function ltcAddressHint(addr: string): string | null {
  const a = addr.trim();
  if (/^(Ltub|Mtub)/.test(a)) return 'Das ist ein erweiterter öffentlicher Schlüssel. Bitte eine einzelne Litecoin-Adresse (L…, M… oder ltc1…) eingeben.';
  if (/^(L|M|ltc1)/i.test(a)) return 'Die Litecoin-Adresse ist nicht gültig (Prüfsumme stimmt nicht) – vermutlich ein Tippfehler. Am besten direkt aus Ledger Live kopieren.';
  return null;
}

export const LITOSHI_PER_LTC = 100_000_000;
