/** Gesamtvermögen – reine Rechenfunktionen (testbar). Basiswährung AED, Anzeige zusätzlich EUR. */

export const AED_PER_USD = 3.6725; // feste Bindung (CBUAE)
export const GRAMS_PER_TROY_OZ = 31.1034768;

export type Cur = 'AED' | 'EUR' | 'USD';
export const CURRENCIES: readonly Cur[] = ['AED', 'EUR', 'USD'];

/** Betrag → AED. EUR braucht den aktuellen Kurs; ohne Kurs null (nie raten). */
export function toAed(amount: number, cur: string, eurAed: number | null): number | null {
  if (cur === 'AED') return amount;
  if (cur === 'USD') return amount * AED_PER_USD;
  if (cur === 'EUR') return eurAed ? amount * eurAed : null;
  return null;
}

/** Wert eines Goldbestands in USD: Gramm × Feingehalt/1000 × Preis je Gramm. */
export function goldValueUsd(grams: number, purity: number, usdPerOz: number): number {
  return grams * (purity / 1000) * (usdPerOz / GRAMS_PER_TROY_OZ);
}

/**
 * Deutsch oder englisch geschriebene Beträge: „12.345,67“, „12345.67“, „12 345“, „-250,5“.
 * Gibt null zurück, wenn es keine eindeutige Zahl ist.
 */
export function parseAmount(input: string): number | null {
  let s = input.trim().replace(/\s|'|€|AED|USD|EUR|\$/gi, '');
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    s = s.replace(dec === '.' ? /,/g : /\./g, '').replace(',', '.');
  } else if (lastComma >= 0) {
    s = (s.match(/,/g)!.length > 1 || s.length - lastComma - 1 === 3) && !/,\d{1,2}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot >= 0) {
    if (s.match(/\./g)!.length > 1 || s.length - lastDot - 1 === 3) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface Part { aed: number; missing: number } // missing = Posten ohne Kurs (nicht mitgezählt)
export function sumParts(values: Array<number | null>): Part {
  return values.reduce<Part>((p, v) => (v == null || !Number.isFinite(v) ? { ...p, missing: p.missing + 1 } : { ...p, aed: p.aed + v }), { aed: 0, missing: 0 });
}
