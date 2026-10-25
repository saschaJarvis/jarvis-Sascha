import ICAL from 'ical.js';

/**
 * Veröffentlichte Kalender (iCal/ICS) lesen: iPhone/iCloud, Google, Outlook.
 * Nur lesend. Wiederholungen (RRULE inkl. Ausnahmen), Zeitzonen (VTIMEZONE) und ganztägige Termine.
 */

export type Provider = 'icloud' | 'google' | 'outlook';

/** Nur bekannte Kalender-Hosts – verhindert, dass der Server beliebige Adressen abruft (SSRF). */
export function providerForHost(host: string): Provider | null {
  const h = host.toLowerCase();
  if (/^p\d{1,3}-caldav\.icloud\.com$/.test(h)) return 'icloud';
  if (h === 'calendar.google.com') return 'google';
  if (h === 'outlook.office365.com' || h === 'outlook.live.com' || h === 'outlook.office.com') return 'outlook';
  return null;
}

export function normalizeCalendarUrl(input: string): { url: string; provider: Provider } | { error: string } {
  const raw = input.trim().replace(/^webcals?:\/\//i, 'https://');
  let u: URL;
  try { u = new URL(raw); } catch { return { error: 'Das ist kein gültiger Link.' }; }
  if (u.protocol !== 'https:') return { error: 'Der Link muss mit https:// oder webcal:// beginnen.' };
  if (u.username || u.password) return { error: 'Links mit Zugangsdaten werden nicht angenommen.' };
  const provider = providerForHost(u.hostname);
  if (!provider) return { error: 'Unbekannter Kalender-Anbieter. Unterstützt: iPhone/iCloud (öffentlicher Kalender), Google, Outlook.' };
  if (u.toString().length > 2000) return { error: 'Link ist zu lang.' };
  return { url: u.toString(), provider };
}

export interface CalEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date | null;
  allDay: boolean;
  /** Bei ganztägigen Terminen: Kalendertage (Tage seit 1970), Ende exklusiv */
  dayFrom?: number;
  dayTo?: number;
  location: string | null;
}

const DAY = 86_400_000;
const dateDay = (t: ICAL.Time) => Date.UTC(t.year, t.month - 1, t.day) / DAY;

export function parseIcs(text: string, from: Date, to: Date, maxEvents = 2000): CalEvent[] {
  const comp = new ICAL.Component(ICAL.parse(text));
  for (const tz of comp.getAllSubcomponents('vtimezone')) {
    try { ICAL.TimezoneService.register(tz); } catch { /* doppelte Registrierung ignorieren */ }
  }
  const events = comp.getAllSubcomponents('vevent').map((v) => new ICAL.Event(v));
  const masters = new Map<string, ICAL.Event>();
  for (const e of events) if (!e.isRecurrenceException()) masters.set(e.uid, e);
  for (const e of events) if (e.isRecurrenceException()) masters.get(e.uid)?.relateException(e);

  const out: CalEvent[] = [];
  const push = (uid: string, title: string, s: ICAL.Time, en: ICAL.Time | null, location: string | null) => {
    const allDay = s.isDate;
    const start = s.toJSDate();
    const end = en ? en.toJSDate() : null;
    if (allDay) {
      const dayFrom = dateDay(s);
      const dayTo = en ? Math.max(dateDay(en), dayFrom + 1) : dayFrom + 1;
      if (dayTo * DAY <= from.getTime() - DAY || dayFrom * DAY >= to.getTime() + DAY) return;
      out.push({ uid, title, start, end, allDay, dayFrom, dayTo, location });
    } else {
      if ((end ?? start) < from || start > to) return;
      out.push({ uid, title, start, end, allDay, location });
    }
  };

  for (const e of masters.values()) {
    if (out.length >= maxEvents) break;
    const status = String(e.component.getFirstPropertyValue('status') ?? '').toUpperCase();
    if (status === 'CANCELLED') continue;
    if (!e.isRecurring()) {
      push(e.uid, e.summary || '(ohne Titel)', e.startDate, e.endDate ?? null, e.location || null);
      continue;
    }
    const it = e.iterator();
    let next: ICAL.Time | null;
    let guard = 0;
    while ((next = it.next()) && guard++ < 5000 && out.length < maxEvents) {
      if (next.toJSDate().getTime() > to.getTime() + DAY) break;
      const d = e.getOccurrenceDetails(next);
      const st = String(d.item.component.getFirstPropertyValue('status') ?? '').toUpperCase();
      if (st === 'CANCELLED') continue;
      push(e.uid, d.item.summary || '(ohne Titel)', d.startDate, d.endDate ?? null, d.item.location || null);
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
