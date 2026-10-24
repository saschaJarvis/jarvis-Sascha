/**
 * Liquiditätsprognose 30/90/180/365 Tage mit Szenarien (optimistisch / Basis / Stress).
 * Deterministisch, eine Währung pro Prognose (Fremdwährungen vorher mit fx.convert umrechnen, Annahme sichtbar).
 */
import { divRoundHalfAwayFromZero } from './money';

export type Recurrence = { kind: 'monthly'; dayOfMonth: number } | { kind: 'every_days'; days: number } | { kind: 'once' };

export interface CashItem {
  id: string;
  label: string;
  amountMinor: bigint;     // + Einnahme, − Ausgabe
  firstDate: string;       // YYYY-MM-DD
  recurrence: Recurrence;
  endDate?: string | null;
  certainty: 'detected' | 'inferred' | 'verified';
}

export interface Scenario { name: 'optimistic' | 'base' | 'stress'; incomePct: number; expensePct: number }

export const SCENARIOS: readonly Scenario[] = [
  { name: 'optimistic', incomePct: 100, expensePct: 95 },
  { name: 'base', incomePct: 100, expensePct: 100 },
  { name: 'stress', incomePct: 80, expensePct: 120 },
];

export interface ForecastResult {
  scenario: Scenario['name'];
  endBalanceMinor: bigint;
  minBalanceMinor: bigint;
  minBalanceDate: string;
  firstShortfallDate: string | null;   // erster Tag unter Mindestreserve
  events: Array<{ date: string; label: string; amountMinor: bigint; balanceAfterMinor: bigint }>;
}

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const parse = (d: string) => Date.parse(`${d}T00:00:00Z`);

function daysInMonth(y: number, m0: number): number {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

export function occurrences(item: CashItem, from: string, to: string): string[] {
  const out: string[] = [];
  const start = parse(item.firstDate);
  const fromT = parse(from); const toT = parse(to);
  const endT = item.endDate ? Math.min(parse(item.endDate), toT) : toT;
  const r = item.recurrence;
  if (r.kind === 'once') {
    if (start >= fromT && start <= endT) out.push(item.firstDate);
    return out;
  }
  if (r.kind === 'every_days') {
    if (r.days < 1) throw new Error('Intervall muss ≥ 1 Tag sein');
    for (let t = start; t <= endT; t += r.days * DAY) if (t >= fromT) out.push(iso(t));
    return out;
  }
  // monatlich am Tag X (bei kürzeren Monaten: letzter Tag)
  const s = new Date(start);
  let y = s.getUTCFullYear(); let m = s.getUTCMonth();
  for (let guard = 0; guard < 1200; guard++) {
    const d = Math.min(r.dayOfMonth, daysInMonth(y, m));
    const t = Date.UTC(y, m, d);
    if (t > endT) break;
    if (t >= fromT && t >= start) out.push(iso(t));
    m++; if (m > 11) { m = 0; y++; }
  }
  return out;
}

export function forecast(startBalanceMinor: bigint, startDate: string, horizonDays: number, items: readonly CashItem[],
  scenario: Scenario, minReserveMinor = 0n): ForecastResult {
  const end = iso(parse(startDate) + horizonDays * DAY);
  const events: ForecastResult['events'] = [];
  const flat: Array<{ date: string; label: string; amountMinor: bigint; id: string }> = [];
  for (const it of items) {
    const pct = BigInt(it.amountMinor >= 0n ? scenario.incomePct : scenario.expensePct);
    const amt = divRoundHalfAwayFromZero(it.amountMinor * pct, 100n);
    for (const d of occurrences(it, startDate, end)) flat.push({ date: d, label: it.label, amountMinor: amt, id: it.id });
  }
  // gleicher Tag: Ausgaben vor Einnahmen (konservativ)
  flat.sort((a, b) => a.date.localeCompare(b.date) || (a.amountMinor < b.amountMinor ? -1 : a.amountMinor > b.amountMinor ? 1 : 0) || a.id.localeCompare(b.id));
  let bal = startBalanceMinor;
  let min = bal; let minDate = startDate;
  let shortfall: string | null = bal < minReserveMinor ? startDate : null;
  for (const e of flat) {
    bal += e.amountMinor;
    events.push({ date: e.date, label: e.label, amountMinor: e.amountMinor, balanceAfterMinor: bal });
    if (bal < min) { min = bal; minDate = e.date; }
    if (shortfall === null && bal < minReserveMinor) shortfall = e.date;
  }
  return { scenario: scenario.name, endBalanceMinor: bal, minBalanceMinor: min, minBalanceDate: minDate, firstShortfallDate: shortfall, events };
}
