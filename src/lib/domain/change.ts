/** 24-Stunden-Veränderung – reine Rechenfunktionen (testbar). */

/** Kraken-OHLC (Stundenkerzen: [zeit, open, high, low, close, …]) → Preis vor 24 h (Eröffnung der Kerze ab jetzt−24 h). */
export function priceAgo(candles: Array<[number, string, string, string, string, ...unknown[]]>, nowSec: number, agoSec = 86_400): number | null {
  const target = nowSec - agoSec;
  let c: (typeof candles)[number] | undefined;
  for (const k of candles) if (Math.abs(k[0] - target) <= 3600 && (!c || Math.abs(k[0] - target) < Math.abs(c[0] - target))) c = k;
  const v = c ? Number(c[1]) : NaN;
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Relative Veränderung (z. B. 0,023 = +2,3 %) aus Preis jetzt und vor 24 h */
export const relChange = (now: number, ago: number | null): number | null => (ago && ago > 0 ? now / ago - 1 : null);

export interface Holding { valueNow: number; change: number | null } // change = relative 24-h-Veränderung des Kurses
/** Wertveränderung eines Bestands: jetzt − vorher = jetzt × c/(1+c). Ohne Kursänderung (Stablecoins) = 0. */
export function portfolioChange(items: Holding[]): { abs: number; pct: number | null; complete: boolean } {
  let abs = 0, before = 0, complete = true;
  for (const h of items) {
    if (h.change == null) { complete = false; before += h.valueNow; continue; }
    const d = h.valueNow * (h.change / (1 + h.change));
    abs += d; before += h.valueNow - d;
  }
  return { abs, pct: before > 0 ? abs / before : null, complete };
}
