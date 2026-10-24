/**
 * Geldbeträge: immer ganze Kleinsteinheiten als bigint (Cent, Fils, Satoshi …).
 * Niemals Gleitkomma für Geld. Rundung ausschließlich hier und explizit.
 */

export type CurrencyCode = string; // ISO 4217 bzw. Krypto-Symbol, Großbuchstaben

export interface Money {
  readonly minor: bigint;
  readonly currency: CurrencyCode;
}

const MINOR_DIGITS: Record<string, number> = {
  EUR: 2, AED: 2, USD: 2, GBP: 2, CHF: 2, JPY: 0,
  BTC: 8, ETH: 18, USDT: 6, USDC: 6, SOL: 9,
};

export function minorDigits(currency: CurrencyCode): number {
  const d = MINOR_DIGITS[currency.toUpperCase()];
  if (d === undefined) throw new Error(`Unbekannte Währung/Asset: ${currency} – Nachkommastellen bitte festlegen`);
  return d;
}

export function money(minor: bigint, currency: CurrencyCode): Money {
  return { minor, currency: currency.toUpperCase() };
}

function assertSame(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new Error(`Währungen verschieden: ${a.currency} / ${b.currency}`);
}

export function add(a: Money, b: Money): Money {
  assertSame(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function sub(a: Money, b: Money): Money {
  assertSame(a, b);
  return money(a.minor - b.minor, a.currency);
}

export function sum(items: readonly Money[], currency: CurrencyCode): Money {
  return items.reduce((acc, m) => add(acc, m), money(0n, currency));
}

/** Division mit kaufmännischer Rundung (half away from zero). */
export function divRoundHalfAwayFromZero(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error('Division durch 0');
  const neg = (n < 0n) !== (d < 0n);
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  const q = an / ad;
  const r = an % ad;
  const rounded = r * 2n >= ad ? q + 1n : q;
  return neg ? -rounded : rounded;
}

/** Banker's Rounding (half to even) – für FX-Umrechnung, um systematische Verzerrung zu vermeiden. */
export function divRoundHalfEven(n: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error('Division durch 0');
  const neg = (n < 0n) !== (d < 0n);
  const an = n < 0n ? -n : n;
  const ad = d < 0n ? -d : d;
  let q = an / ad;
  const r2 = (an % ad) * 2n;
  if (r2 > ad || (r2 === ad && q % 2n === 1n)) q += 1n;
  return neg ? -q : q;
}

/**
 * Dezimalzahl als Text exakt in (Zähler, Skala) zerlegen, z. B. "4.0123" -> {int: 40123n, scale: 4}.
 * Akzeptiert Punkt als Dezimaltrenner (maschinelles Format).
 */
export function parseDecimal(text: string): { int: bigint; scale: number } {
  const t = text.trim();
  if (!/^[-+]?\d+(\.\d+)?$/.test(t)) throw new Error(`Keine gültige Dezimalzahl: "${text}"`);
  const neg = t.startsWith('-');
  const body = t.replace(/^[-+]/, '');
  const [i, f = ''] = body.split('.');
  const int = BigInt(i + f) * (neg ? -1n : 1n);
  return { int, scale: f.length };
}

/**
 * Deutsch/international formatierte Beträge aus Kontoauszügen parsen.
 * "1.234,56" | "-1234,56" | "1,234.56" | "1234.56" | "12" | "−7,50" (Unicode-Minus) | "7,50-" (nachgestelltes Minus)
 */
export function parseAmount(text: string, currency: CurrencyCode, locale: 'de' | 'en' | 'auto' = 'auto'): Money {
  let t = text.trim().replace(/−/g, '-').replace(/[\s ']/g, '').replace(/(EUR|AED|USD|€|\$)/gi, '');
  let neg = false;
  if (t.endsWith('-')) { neg = true; t = t.slice(0, -1); }
  if (t.startsWith('-')) { neg = !neg; t = t.slice(1); } else if (t.startsWith('+')) t = t.slice(1);
  if (t.startsWith('(') && t.endsWith(')')) { neg = !neg; t = t.slice(1, -1); }
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) throw new Error(`Betrag nicht lesbar: "${text}"`);

  let decimalSep: ',' | '.' | null = null;
  if (locale === 'de') decimalSep = ',';
  else if (locale === 'en') decimalSep = '.';
  else {
    const lastComma = t.lastIndexOf(',');
    const lastDot = t.lastIndexOf('.');
    if (lastComma >= 0 && lastDot >= 0) decimalSep = lastComma > lastDot ? ',' : '.';
    else if (lastComma >= 0 || lastDot >= 0) {
      const sep = lastComma >= 0 ? ',' : '.';
      const count = t.split(sep).length - 1;
      const after = t.length - t.lastIndexOf(sep) - 1;
      if (count > 1) decimalSep = null;                 // 1.234.567 -> Tausendertrennzeichen
      else if (after === 3) throw new Error(`Betrag mehrdeutig (Tausender oder Dezimal?): "${text}" – Format angeben`);
      else decimalSep = sep;
    }
  }
  let intPart = t;
  let fracPart = '';
  if (decimalSep) {
    const idx = t.lastIndexOf(decimalSep);
    if (idx >= 0) { intPart = t.slice(0, idx); fracPart = t.slice(idx + 1); }
  }
  intPart = intPart.replace(/[.,]/g, '');
  if (/[.,]/.test(fracPart)) throw new Error(`Betrag mehrdeutig: "${text}"`);
  const digits = minorDigits(currency);
  if (fracPart.length > digits) throw new Error(`Zu viele Nachkommastellen für ${currency}: "${text}"`);
  const minor = BigInt((intPart || '0') + fracPart.padEnd(digits, '0'));
  return money(neg ? -minor : minor, currency);
}

export function formatMoney(m: Money, locale = 'de-DE'): string {
  const digits = minorDigits(m.currency);
  const neg = m.minor < 0n;
  const abs = neg ? -m.minor : m.minor;
  const base = 10n ** BigInt(digits);
  const int = abs / base;
  const frac = (abs % base).toString().padStart(digits, '0');
  const intStr = int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, locale.startsWith('de') ? '.' : ',');
  const sep = locale.startsWith('de') ? ',' : '.';
  const num = digits > 0 ? `${intStr}${sep}${frac}` : intStr;
  return `${neg ? '−' : ''}${num} ${m.currency}`;
}
