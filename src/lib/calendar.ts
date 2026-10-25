/**
 * Wochenkalender (Mo–So) in der Zeitzone des Nutzers. Reine Logik, ohne Server-Abhängigkeiten.
 * Zeigt Jarvis-Aufgaben mit Frist und – falls verbunden – Termine aus externen Kalendern.
 */
import { holidaysBetween, type Holiday } from './holidays';
import { observancesBetween, type Observance } from './special-days';

export interface CalTask { id: string; title: string; due_at: Date | string | null; domain: string; due_is_hard: boolean; status?: string; version?: number }
export interface CalExternal { uid: string; title: string; start: Date; end: Date | null; allDay: boolean; dayFrom?: number; dayTo?: number; location: string | null; source: string }

export interface CalItem {
  kind: 'task' | 'event';
  id: string;
  title: string;
  time: string | null;      // null = ganztägig / ohne Uhrzeit
  endTime: string | null;
  domain: string;
  overdue: boolean;
  hard: boolean;
  location: string | null;
  source: string | null;    // Kalendername bei Terminen
  done?: boolean;           // Aufgabe abgehakt
  version?: number;         // für Abhaken (optimistische Sperre)
}

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

export function buildCalendar(tasks: readonly CalTask[], tz: string, now: Date, weeksBack = 1, weeksAhead = 8, events: readonly CalExternal[] = [], holidayState: 'RP' | null = 'RP') {
  const today = dayNo(now, tz);
  const monday = today - ((new Date(today * DAY).getUTCDay() + 6) % 7);
  const timeFmt = new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const byDay = new Map<number, Array<CalItem & { sort: number }>>();
  const add = (dn: number, item: CalItem & { sort: number }) => { const l = byDay.get(dn) ?? []; l.push(item); byDay.set(dn, l); };

  for (const t of tasks) {
    if (!t.due_at) continue;
    const due = new Date(t.due_at);
    const time = timeFmt.format(due);
    const done = t.status === 'CLOSED';
    add(dayNo(due, tz), { kind: 'task', id: t.id, title: t.title, time: time === '00:00' ? null : time, endTime: null, domain: t.domain,
      overdue: !done && due < now, hard: t.due_is_hard, location: null, source: null, done, version: t.version, sort: due.getTime() });
  }
  for (const e of events) {
    const base = { kind: 'event' as const, title: e.title, domain: 'calendar', overdue: false, hard: false, location: e.location, source: e.source };
    if (e.allDay && e.dayFrom != null) {
      const last = Math.min(e.dayTo ?? e.dayFrom + 1, e.dayFrom + 14);
      for (let dn = e.dayFrom; dn < last; dn++) add(dn, { ...base, id: `${e.uid}:${dn}`, time: null, endTime: null, sort: dn * DAY });
    } else {
      add(dayNo(e.start, tz), { ...base, id: `${e.uid}:${e.start.getTime()}`, time: timeFmt.format(e.start),
        endTime: e.end ? timeFmt.format(e.end) : null, sort: e.start.getTime() });
    }
  }

  const hol = new Map<number, Holiday>(holidaysBetween(monday - weeksBack * 7, monday + weeksAhead * 7 + 6, holidayState).map((h) => [h.dn, h]));
  const obs = new Map<number, Observance[]>();
  for (const o of observancesBetween(monday - weeksBack * 7, monday + weeksAhead * 7 + 6)) obs.set(o.dn, [...(obs.get(o.dn) ?? []), o]);
  const weeks = [];
  for (let w = -weeksBack; w <= weeksAhead; w++) {
    const start = monday + w * 7;
    const days = Array.from({ length: 7 }, (_, i) => {
      const dn = start + i;
      const dow = new Date(dn * DAY).getUTCDay();
      const items = (byDay.get(dn) ?? [])
        .sort((a, b) => (a.time === null && b.time !== null ? -1 : b.time === null && a.time !== null ? 1 : a.sort - b.sort))
        .map(({ sort: _s, ...x }) => x);
      const h = hol.get(dn);
      return { key: dn, wd: WD[dow], wdLong: WD_LONG[dow], date: `${ddmm(dn)}${new Date(dn * DAY).getUTCFullYear()}`, isToday: dn === today, isPast: dn < today,
        holiday: h ? { name: h.name, scope: h.scope, emoji: h.emoji } : null,
        observances: (obs.get(dn) ?? []).map((o) => ({ name: o.name, note: o.note, kind: o.kind, emoji: o.emoji })), items };
    });
    weeks.push({ offset: w, label: `KW ${isoWeek(start)} · ${ddmm(start)} – ${ddmm(start + 6)}`, days });
  }
  return weeks;
}

/** Termine eines Tages (für Heute-Ansicht und Lagebericht) */
export function eventsOnDay(events: readonly CalExternal[], tz: string, dn: number): CalExternal[] {
  return events.filter((e) => (e.allDay && e.dayFrom != null ? e.dayFrom <= dn && dn < (e.dayTo ?? e.dayFrom + 1) : dayNo(e.start, tz) === dn));
}
