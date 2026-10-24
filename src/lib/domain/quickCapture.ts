/**
 * Schnellerfassung auf Deutsch: "Erinnere mich nächste Woche, die Bank anzurufen" -> Aufgabe + Termin.
 * Regelbasiert (kein LLM), damit Fristen deterministisch sind. Ist keine Uhrzeit genannt, wird eine
 * Standardzeit vorgeschlagen und als Annahme markiert – nachgefragt wird nur, wenn nötig.
 */
import { toLocalParts, zonedToUtc, nextWeekMonday } from './time';

export interface CaptureResult {
  title: string;
  dueAt: Date | null;
  assumptions: string[];
  needsTime: boolean;
}

const WEEKDAYS: Record<string, number> = { montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonntag: 7 };

export function parseQuickCapture(input: string, now: Date, tz: string, defaultHour = 9): CaptureResult {
  let text = input.trim();
  const assumptions: string[] = [];
  const p = toLocalParts(now, tz);
  let day: { y: number; m: number; d: number } | null = null;
  let weekBased: Date | null = null;

  const addDays = (n: number) => {
    const t = new Date(Date.UTC(p.year, p.month - 1, p.day) + n * 86_400_000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  };
  const take = (re: RegExp) => { const m = re.exec(text); if (m) text = text.replace(m[0], ' '); return m; };

  let m: RegExpExecArray | null;
  if ((m = take(/\bübermorgen\b/i))) day = addDays(2);
  else if ((m = take(/\bmorgen\b/i))) day = addDays(1);
  else if ((m = take(/\bheute\b/i))) day = addDays(0);
  else if ((m = take(/\bin (\d{1,3}) tag(?:en)?\b/i))) day = addDays(+m[1]);
  else if ((m = take(/\bnächste[nr]? woche\b/i))) { weekBased = nextWeekMonday(now, tz, defaultHour); assumptions.push('„nächste Woche" = Montag der nächsten Woche'); }
  else if ((m = take(/\b(?:am |nächsten )?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/i))) {
    const target = WEEKDAYS[m[1].toLowerCase()];
    let diff = (target - p.weekday + 7) % 7;
    if (diff === 0) diff = 7;
    day = addDays(diff);
  } else if ((m = take(/\b(?:am )?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/))) {
    const yy = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : p.year;
    day = { y: yy, m: +m[2], d: +m[1] };
    if (!m[3] && (day.m < p.month || (day.m === p.month && day.d < p.day))) { day.y += 1; assumptions.push('Datum liegt im nächsten Jahr'); }
  }

  let hour: number | null = null; let minute = 0;
  if ((m = take(/\bum (\d{1,2})(?::(\d{2}))?\s*(?:uhr)?\b/i)) || (m = take(/\b(\d{1,2}):(\d{2})\s*(?:uhr)?\b/i)) || (m = take(/\b(\d{1,2})\s*uhr\b/i))) {
    hour = +m[1]; minute = m[2] ? +m[2] : 0;
    if (hour > 23 || minute > 59) { hour = null; minute = 0; }
  }

  let dueAt: Date | null = null;
  let needsTime = false;
  if (weekBased) {
    dueAt = hour !== null ? (() => { const wp = toLocalParts(weekBased!, tz); return zonedToUtc(wp.year, wp.month, wp.day, hour!, minute, tz); })() : weekBased;
    if (hour === null) assumptions.push(`Uhrzeit ${defaultHour}:00 angenommen`);
  } else if (day) {
    if (hour === null) { hour = defaultHour; assumptions.push(`Uhrzeit ${defaultHour}:00 angenommen`); }
    dueAt = zonedToUtc(day.y, day.m, day.d, hour, minute, tz);
  } else if (hour !== null) {
    dueAt = zonedToUtc(p.year, p.month, p.day, hour, minute, tz);
    if (dueAt <= now) { const t = addDays(1); dueAt = zonedToUtc(t.y, t.m, t.d, hour, minute, tz); assumptions.push('Uhrzeit heute vorbei – morgen angenommen'); }
  } else {
    needsTime = false; // ohne Datum: Aufgabe ohne Frist, keine Rückfrage nötig
  }

  // Titel aufräumen: Füllwörter am Anfang entfernen, Infinitiv-Konstruktion umstellen
  let title = text.replace(/\s+/g, ' ').trim()
    .replace(/^(bitte\s+)?(erinnere?|erinner)\s+mich\s*(daran)?\s*,?\s*/i, '')
    .replace(/^(dass ich|an)\s+/i, '')
    .replace(/^,\s*/, '')
    .replace(/\s*,\s*$/, '');
  const zu = /^(?:die|den|das|der)?\s*(.+?)\s+(\w+)zu(\w+)$|^(.+?)\s+zu\s+(\w+)$/i.exec(title);
  if (zu && zu[4] && zu[5]) title = `${zu[4]} ${zu[5]}`;
  else if (zu && zu[1]) title = `${zu[1]} ${zu[2]}${zu[3]}`;
  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (!title) title = 'Neue Aufgabe';
  return { title, dueAt, assumptions, needsTime };
}
