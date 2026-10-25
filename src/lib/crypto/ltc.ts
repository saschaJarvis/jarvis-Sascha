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

// ---------- Ganzes Konto über den erweiterten öffentlichen Schlüssel (xpub) ----------
// Versionsbytes (SLIP-132): Ltub = Litecoin-xpub (Ledger nutzt es für alle Kontoarten), Mtub = P2SH-SegWit, zpub = natives SegWit
const XPUB_VERSIONS: Record<string, string> = { '019da462': 'Ltub', '01b26ef6': 'Mtub', '04b24746': 'zpub', '0488b21e': 'xpub' };
export type LtcScheme = 'sh(wpkh)' | 'wpkh' | 'pkh';

export function isLtcXpub(x: string): boolean {
  const a = x.trim();
  if (!/^(Ltub|Mtub|zpub|xpub)[1-9A-HJ-NP-Za-km-z]{100,112}$/.test(a)) return false;
  const raw = base58check(a, 82);
  return !!raw && XPUB_VERSIONS[raw.subarray(0, 4).toString('hex')] === a.slice(0, 4);
}

/** Descriptor für Blockbook, z. B. „sh(wpkh(Ltub…))“ */
export const ltcDescriptor = (xpub: string, scheme: LtcScheme) => (scheme === 'sh(wpkh)' ? `sh(wpkh(${xpub}))` : `${scheme}(${xpub})`);
export const isLtcDescriptor = (s: string) => /^(sh\(wpkh\(|wpkh\(|pkh\()(Ltub|Mtub|zpub|xpub)[1-9A-HJ-NP-Za-km-z]{100,112}\)\)?$/.test(s);

/**
 * Eingabe auswerten: nackter xpub oder der Ledger-Live-Export (JSON mit xpub und id „…:segwit“).
 * Ledger schreibt Litecoin-Konten immer als „Ltub“; die Kontoart steht nur in der id.
 */
export function parseLtcXpubInput(input: string): { descriptor: string } | { error: string } | null {
  let xpub = input.trim();
  let scheme: LtcScheme | null = null;
  if (xpub.startsWith('{')) {
    try {
      const j = JSON.parse(xpub) as { xpub?: unknown; id?: unknown };
      if (typeof j.xpub !== 'string') return null;
      xpub = j.xpub.trim();
      const id = typeof j.id === 'string' ? j.id : '';
      if (!/litecoin/i.test(id) && id) return { error: 'Das ist der Export eines anderen Kontos – bitte das Litecoin-Konto aus Ledger Live nehmen.' };
      scheme = /:native_segwit$/.test(id) ? 'wpkh' : /:segwit$/.test(id) ? 'sh(wpkh)' : /:legacy$/.test(id) ? 'pkh' : null;
    } catch { return { error: 'Der eingefügte Text ist kein gültiger Ledger-Export.' }; }
  }
  if (!/^(Ltub|Mtub|zpub)/.test(xpub)) return null;
  if (xpub.startsWith('zpub') && !scheme) return null; // nackter zpub ist meist Bitcoin – nur mit Ledger-Export als Litecoin werten
  if (!isLtcXpub(xpub)) return { error: 'Der Litecoin-Kontoschlüssel ist nicht gültig (Prüfsumme stimmt nicht) – bitte vollständig aus Ledger Live kopieren.' };
  scheme ??= xpub.startsWith('zpub') ? 'wpkh' : 'sh(wpkh)'; // Ledger-Standard für Litecoin: SegWit (Adressen M…)
  return { descriptor: ltcDescriptor(xpub, scheme) };
}
