/**
 * Gesetzliche Feiertage in Deutschland – berechnet (kein Abruf nötig).
 * Bundesweit + Rheinland-Pfalz (Mainz). Grundlage: Feiertagsgesetze des Bundes/der Länder;
 * RLP: Landesfeiertagsgesetz (Fronleichnam, Allerheiligen).
 */
export interface Holiday { dn: number; date: string; name: string; scope: 'bundesweit' | 'Rheinland-Pfalz'; emoji: string }

const DAY = 86_400_000;

/** Ostersonntag (gregorianisch, Anonymous/Meeus-Algorithmus) als Tageszahl seit 1970 */
export function easterSunday(year: number): number {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(year, month - 1, day) / DAY;
}

const fixed = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / DAY;
const iso = (dn: number) => new Date(dn * DAY).toISOString().slice(0, 10);

const EMOJI: Record<string, string> = {
  'Neujahr': '🥂', 'Karfreitag': '✝️', 'Ostermontag': '🐰', 'Tag der Arbeit': '🛠️', 'Christi Himmelfahrt': '☁️',
  'Pfingstmontag': '🕊️', 'Tag der Deutschen Einheit': '🇩🇪', '1. Weihnachtstag': '🎁', '2. Weihnachtstag': '🎁',
  'Fronleichnam': '⛪', 'Allerheiligen': '🕯️',
};

export function germanHolidays(year: number, state: 'RP' | null = 'RP'): Holiday[] {
  const e = easterSunday(year);
  const list: Array<[number, string, Holiday['scope']]> = [
    [fixed(year, 1, 1), 'Neujahr', 'bundesweit'],
    [e - 2, 'Karfreitag', 'bundesweit'],
    [e + 1, 'Ostermontag', 'bundesweit'],
    [fixed(year, 5, 1), 'Tag der Arbeit', 'bundesweit'],
    [e + 39, 'Christi Himmelfahrt', 'bundesweit'],
    [e + 50, 'Pfingstmontag', 'bundesweit'],
    [fixed(year, 10, 3), 'Tag der Deutschen Einheit', 'bundesweit'],
    [fixed(year, 12, 25), '1. Weihnachtstag', 'bundesweit'],
    [fixed(year, 12, 26), '2. Weihnachtstag', 'bundesweit'],
  ];
  if (state === 'RP') {
    list.push([e + 60, 'Fronleichnam', 'Rheinland-Pfalz'], [fixed(year, 11, 1), 'Allerheiligen', 'Rheinland-Pfalz']);
  }
  return list.map(([dn, name, scope]) => ({ dn, date: iso(dn), name, scope, emoji: EMOJI[name] ?? '🇩🇪' })).sort((a, b) => a.dn - b.dn);
}

/** Feiertage für einen Zeitraum von Kalendertagen (inklusive) */
export function holidaysBetween(fromDn: number, toDn: number, state: 'RP' | null = 'RP'): Holiday[] {
  const y1 = new Date(fromDn * DAY).getUTCFullYear(), y2 = new Date(toDn * DAY).getUTCFullYear();
  const out: Holiday[] = [];
  for (let y = y1; y <= y2; y++) out.push(...germanHolidays(y, state).filter((h) => h.dn >= fromDn && h.dn <= toDn));
  return out;
}
