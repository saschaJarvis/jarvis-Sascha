/**
 * Termin-Erinnerungen (reine Logik): Eine Erinnerung je Termin, sobald er in höchstens `leadMin` Minuten beginnt.
 * Ganztägige Termine bekommen keine Erinnerung. Wird ein Termin verschoben, ändert sich der Schlüssel → neue Erinnerung.
 * Kurzfristig eingetragene Termine (weniger als `leadMin` vorher) werden sofort erinnert, solange sie noch nicht begonnen haben.
 */
export interface ReminderEvent { uid: string; title: string; start: Date; allDay: boolean; location: string | null; source: string }
export interface EventReminder { key: string; event: ReminderEvent; minutesLeft: number }

const MIN = 60_000;

export function eventRemindersDue(events: readonly ReminderEvent[], now: Date, leadMin = 60): EventReminder[] {
  const t = now.getTime();
  const out: EventReminder[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    if (e.allDay) continue;
    const s = e.start.getTime();
    if (!Number.isFinite(s) || s <= t || s - t > leadMin * MIN) continue;
    const key = `event:${e.uid}:${e.start.toISOString()}`.slice(0, 200);
    if (seen.has(key)) continue; // gleicher Termin in zwei Kalendern
    seen.add(key);
    out.push({ key, event: e, minutesLeft: Math.max(1, Math.round((s - t) / MIN)) });
  }
  return out;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Wie lange noch – „in einer Stunde“, „in 25 Minuten“. */
export function untilText(min: number): string {
  if (min >= 55 && min <= 65) return 'in einer Stunde';
  if (min >= 90 && min % 60 === 0) return `in ${min / 60} Stunden`;
  return min === 1 ? 'in einer Minute' : `in ${min} Minuten`;
}

/** Texte für Telegram-Nachricht und Sprachansage. */
export function reminderTexts(r: EventReminder, tz: string): { title: string; body: string; call: string } {
  const time = new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(r.event.start);
  const title = clean(r.event.title) || 'Termin';
  const loc = r.event.location ? clean(r.event.location) : null;
  const until = untilText(r.minutesLeft);
  const body = `${until[0].toUpperCase()}${until.slice(1)}, um ${time} Uhr${loc ? `\n📍 ${loc}` : ''}\nKalender: ${r.event.source}`;
  let call = `Hallo Sascha, hier ist Jarvis. Erinnerung: ${until}, um ${time} Uhr: ${title}.${loc ? ` Ort: ${loc}.` : ''}`;
  if (call.length > 256) call = `${call.slice(0, 253)}…`;
  return { title: `📅 ${title} – ${time} Uhr`.slice(0, 120), body, call };
}
