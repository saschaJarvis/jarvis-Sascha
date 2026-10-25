import { toLocalParts, zonedToUtc } from './time';

/** Wiederkehrende Zahlung → Fälligkeiten je Monat (rein, testbar). */
export interface Bill { id: string; title: string; day_of_month: number; remind_hour: number }
export interface BillOccurrence { month: string; dueAt: Date; monthLabel: string; key: string }

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m: 1–12

/** Fälligkeit im Monat (y, m) – Tag -1 = letzter Tag; 1–28 fest. Lokale Uhrzeit remind_hour in tz. */
export function billDue(bill: Pick<Bill, 'day_of_month' | 'remind_hour'>, y: number, m: number, tz: string): Date {
  const d = bill.day_of_month === -1 ? lastDay(y, m) : Math.min(bill.day_of_month, lastDay(y, m));
  return zonedToUtc(y, m, d, bill.remind_hour, 0, tz);
}

/** Aktueller Monat + monthsAhead weitere (lokal in tz). */
export function billOccurrences(bill: Bill, now: Date, tz: string, monthsAhead = 1): BillOccurrence[] {
  const p = toLocalParts(now, tz);
  const out: BillOccurrence[] = [];
  for (let i = 0; i <= monthsAhead; i++) {
    const idx = p.month - 1 + i;
    const y = p.year + Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    const month = `${y}-${String(m).padStart(2, '0')}`;
    out.push({ month, dueAt: billDue(bill, y, m, tz), monthLabel: `${MONTHS[m - 1]} ${y}`, key: `bill:${bill.id}:${month}` });
  }
  return out;
}
