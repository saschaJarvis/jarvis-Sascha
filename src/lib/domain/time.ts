/**
 * Zeitzonen-sichere Hilfen ohne externe Bibliothek (nutzt Intl, IANA-Zonen).
 * Alle Zeitpunkte intern als UTC-Date; "lokal" bedeutet in der Zeitzone des Nutzers.
 */

export interface LocalParts {
  year: number; month: number; day: number; hour: number; minute: number; second: number;
  weekday: number; // 1 = Montag … 7 = Sonntag
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function assertTimeZone(tz: string): void {
  try { fmt(tz).format(new Date(0)); } catch { throw new Error(`Unbekannte Zeitzone: ${tz}`); }
}

export function toLocalParts(instant: Date, tz: string): LocalParts {
  const parts = Object.fromEntries(fmt(tz).formatToParts(instant).map((p) => [p.type, p.value]));
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1;
  return {
    year: +parts.year, month: +parts.month, day: +parts.day,
    hour: +parts.hour, minute: +parts.minute, second: +parts.second, weekday: wd,
  };
}

/** Offset der Zone zu UTC in Minuten zum Zeitpunkt instant (z. B. Europe/Berlin Sommer = +120). */
export function tzOffsetMinutes(instant: Date, tz: string): number {
  const p = toLocalParts(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/**
 * Lokale Wandzeit -> UTC-Zeitpunkt. Bei Lücken (Sommerzeit-Umstellung) wird nach vorn verschoben,
 * bei Doppeldeutigkeit (Rückstellung) der frühere Zeitpunkt genommen.
 */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const off1 = tzOffsetMinutes(new Date(guess), tz);
  let t = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(new Date(t), tz);
  if (off2 !== off1) t = guess - off2 * 60000;
  // Lücke: Ergebnis zeigt andere Wandzeit -> vorwärts schieben
  const back = toLocalParts(new Date(t), tz);
  if (back.hour !== hour || back.minute !== minute) {
    t = guess - Math.min(off1, off2) * 60000;
  }
  return new Date(t);
}

export function parseHHMM(s: string): { h: number; m: number } {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s.trim());
  if (!m) throw new Error(`Uhrzeit ungültig: ${s}`);
  const h = +m[1]; const mi = +m[2];
  if (h > 23 || mi > 59) throw new Error(`Uhrzeit ungültig: ${s}`);
  return { h, m: mi };
}

/** Liegt instant in den Ruhezeiten [start, end) (lokal)? Unterstützt Zeiträume über Mitternacht. */
export function isInQuietHours(instant: Date, tz: string, start: string, end: string): boolean {
  const p = toLocalParts(instant, tz);
  const now = p.hour * 60 + p.minute;
  const s = parseHHMM(start); const e = parseHHMM(end);
  const sm = s.h * 60 + s.m; const em = e.h * 60 + e.m;
  if (sm === em) return false;
  return sm < em ? now >= sm && now < em : now >= sm || now < em;
}

/** Nächster Zeitpunkt >= instant außerhalb der Ruhezeiten. */
export function nextAllowedInstant(instant: Date, tz: string, start: string, end: string): Date {
  if (!isInQuietHours(instant, tz, start, end)) return instant;
  const p = toLocalParts(instant, tz);
  const e = parseHHMM(end);
  const nowMin = p.hour * 60 + p.minute;
  const endMin = e.h * 60 + e.m;
  // Ende liegt heute (falls noch nicht erreicht) oder morgen
  const base = Date.UTC(p.year, p.month - 1, p.day) + (nowMin >= endMin ? 86_400_000 : 0);
  const d = new Date(base);
  return zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), e.h, e.m, tz);
}

/** Lokaler Kalendertag als YYYY-MM-DD (für Tageslimits). */
export function localDateKey(instant: Date, tz: string): string {
  const p = toLocalParts(instant, tz);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** "nächste Woche" etc.: Montag der Folgewoche, lokale Uhrzeit hh:mm. */
export function nextWeekMonday(instant: Date, tz: string, hour = 9, minute = 0): Date {
  const p = toLocalParts(instant, tz);
  const daysToAdd = 8 - p.weekday; // Mo->7, So->1
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day) + daysToAdd * 86_400_000);
  return zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hour, minute, tz);
}
