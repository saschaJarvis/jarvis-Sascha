/**
 * Wochenkalender (Mo–So) in der Zeitzone des Nutzers. Reine Logik, ohne Server-Abhängigkeiten.
 */
export interface CalTask { id: string; title: string; due_at: Date | string | null; domain: string; due_is_hard: boolean }

const DAY = 86_400_000;
/** Kalendertag (Tage seit 1970) in Zeitzone tz */
export const dayNo = (d: Date, tz: string) =>
  Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)) / DAY;

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const pad = (n: number) => String(n).padStart(2, '0');
const ddmm = (dn: number) => { const d = new Date(dn * DAY); return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.`; };

/** ISO-Kalenderwoche */
export function isoWeek(dn: number): number {
  const d = new Date(dn * DAY);
  const dow = (d.getUTCDay() + 6) % 7;
  const thursday = dn - dow + 3;
  const t = new Date(thursday * DAY);
  const jan1 = Date.UTC(t.getUTCFullYear(), 0, 1) / DAY;
  return Math.floor((thursday - jan1) / 7) + 1;
}

export function buildCalendar(tasks: readonly CalTask[], tz: string, now: Date, weeksBack = 1, weeksAhead = 8) {
  const today = dayNo(now, tz);
  const monday = today - ((new Date(today * DAY).getUTCDay() + 6) % 7);
  const timeFmt = new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const byDay = new Map<number, Array<{ id: string; title: string; time: string | null; domain: string; overdue: boolean; hard: boolean; sort: number }>>();
  for (const t of tasks) {
    if (!t.due_at) continue;
    const due = new Date(t.due_at);
    const dn = dayNo(due, tz);
    const time = timeFmt.format(due);
    const list = byDay.get(dn) ?? [];
    list.push({ id: t.id, title: t.title, time: time === '00:00' ? null : time, domain: t.domain, overdue: due < now, hard: t.due_is_hard, sort: due.getTime() });
    byDay.set(dn, list);
  }
  const weeks = [];
  for (let w = -weeksBack; w <= weeksAhead; w++) {
    const start = monday + w * 7;
    const days = Array.from({ length: 7 }, (_, i) => {
      const dn = start + i;
      const dow = new Date(dn * DAY).getUTCDay();
      const items = (byDay.get(dn) ?? []).sort((a, b) => (a.time === null ? -1 : b.time === null ? 1 : a.sort - b.sort))
        .map(({ sort: _s, ...x }) => x);
      return { key: dn, wd: WD[dow], wdLong: WD_LONG[dow], date: `${ddmm(dn)}${new Date(dn * DAY).getUTCFullYear()}`, isToday: dn === today, isPast: dn < today, items };
    });
    weeks.push({ offset: w, label: `KW ${isoWeek(start)} · ${ddmm(start)} – ${ddmm(start + 6)}`, days });
  }
  return weeks;
}
