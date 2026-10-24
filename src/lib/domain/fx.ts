import { Money, money, minorDigits, parseDecimal, divRoundHalfEven } from './money';

/** Ein Wechselkurs ist nur mit Datum und Quelle gültig. 1 base = rate quote. */
export interface FxRate {
  base: string;
  quote: string;
  rate: string;      // exakter Dezimaltext, z. B. "4.0123"
  asOf: string;      // YYYY-MM-DD
  source: string;    // z. B. "EZB-Referenzkurs" oder "manuell (Annahme)"
}

export interface Converted {
  value: Money;
  rate: FxRate;
  /** true, wenn der Kurs älter ist als maxAgeDays relativ zum Stichtag */
  stale: boolean;
  /** Rechenweg für die Anzeige ("Annahme sichtbar machen") */
  explanation: string;
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function convert(amount: Money, target: string, rates: readonly FxRate[], onDate: string, maxAgeDays = 7): Converted {
  const to = target.toUpperCase();
  if (amount.currency === to) {
    return {
      value: amount, stale: false, explanation: 'gleiche Währung',
      rate: { base: to, quote: to, rate: '1', asOf: onDate, source: 'identisch' },
    };
  }
  // passenden Kurs suchen: direkt oder invers; jüngster Kurs <= Stichtag
  const candidates = rates
    .filter((r) => r.asOf <= onDate &&
      ((r.base === amount.currency && r.quote === to) || (r.base === to && r.quote === amount.currency)))
    .sort((x, y) => (x.asOf < y.asOf ? 1 : x.asOf > y.asOf ? -1 : x.source.localeCompare(y.source)));
  const r = candidates[0];
  if (!r) throw new Error(`Kein Kurs ${amount.currency}/${to} bis ${onDate} vorhanden – bitte Kurs mit Quelle hinterlegen`);

  const { int, scale } = parseDecimal(r.rate);
  if (int <= 0n) throw new Error('Kurs muss positiv sein');
  const fromDigits = minorDigits(amount.currency);
  const toDigits = minorDigits(to);
  const shift = BigInt(toDigits - fromDigits);
  const tenScale = 10n ** BigInt(scale);

  let num: bigint;
  let den: bigint;
  if (r.base === amount.currency) {
    // value_to = amount * rate
    num = amount.minor * int;
    den = tenScale;
  } else {
    // value_to = amount / rate
    num = amount.minor * tenScale;
    den = int;
  }
  if (shift >= 0n) num *= 10n ** shift; else den *= 10n ** -shift;
  const value = money(divRoundHalfEven(num, den), to);
  const age = daysBetween(r.asOf, onDate);
  return {
    value,
    rate: r,
    stale: age > maxAgeDays,
    explanation: `${r.base === amount.currency ? '×' : '÷'} ${r.rate} (${r.base}/${r.quote}, Stand ${r.asOf}, Quelle: ${r.source})`,
  };
}
