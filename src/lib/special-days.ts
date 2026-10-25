/**
 * Besondere Tage (keine gesetzlichen Feiertage): Jahreszeiten, Advent/Weihnachten/Silvester,
 * Mainzer Fastnacht, Muttertag, Valentinstag, Halloween, Zeitumstellung in Deutschland.
 * Alles berechnet – kein externer Abruf.
 */
import { easterSunday } from './holidays';

export interface Observance { dn: number; date: string; name: string; note: string | null; kind: 'season' | 'tradition' | 'clock' }

const DAY = 86_400_000;
const D2R = Math.PI / 180;
const fixed = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) / DAY;
const iso = (dn: number) => new Date(dn * DAY).toISOString().slice(0, 10);
const dow = (dn: number) => new Date(dn * DAY).getUTCDay(); // 0 = Sonntag
const lastSunday = (y: number, m: number) => { const last = fixed(y, m + 1, 0); return last - dow(last); };
const nthSunday = (y: number, m: number, n: number) => { const first = fixed(y, m, 1); return first + ((7 - dow(first)) % 7) + (n - 1) * 7; };

// Meeus, Astronomical Algorithms, Kap. 27 (Jahre 1000–3000): Genauigkeit ~1 Minute
const PERIODIC: Array<[number, number, number]> = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186], [182, 27.85, 445267.112],
  [156, 73.14, 45036.886], [136, 171.52, 22518.443], [77, 222.54, 65928.934], [74, 296.72, 3034.906],
  [70, 243.58, 9037.513], [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
  [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417], [18, 155.12, 67555.328],
  [17, 288.79, 4562.452], [16, 198.04, 62894.029], [14, 199.76, 31436.921], [12, 95.39, 14577.848],
  [12, 287.11, 31931.756], [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
];
const MEAN: Record<'march' | 'june' | 'september' | 'december', number[]> = {
  march: [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
  june: [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.0003],
  september: [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
  december: [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
};

/** Zeitpunkt (UTC) von Tag-und-Nacht-Gleiche bzw. Sonnenwende */
export function seasonStart(year: number, which: keyof typeof MEAN): Date {
  const Y = (year - 2000) / 1000;
  const c = MEAN[which];
  const jde0 = c[0] + c[1] * Y + c[2] * Y ** 2 + c[3] * Y ** 3 + c[4] * Y ** 4;
  const T = (jde0 - 2451545.0) / 36525;
  const W = (35999.373 * T - 2.47) * D2R;
  const dl = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);
  const S = PERIODIC.reduce((s, [A, B, C]) => s + A * Math.cos((B + C * T) * D2R), 0);
  const jde = jde0 + (0.00001 * S) / dl;
  const tt = (jde - 2440587.5) * DAY;
  return new Date(tt - 69_000); // TT → UTC (ΔT ≈ 69 s)
}

export function observances(year: number, tz = 'Europe/Berlin'): Observance[] {
  const e = easterSunday(year);
  const de = (d: Date) => new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d);
  const dayIn = (d: Date) => Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)) / DAY;
  const season = (which: keyof typeof MEAN, name: string, extra: string) => {
    const t = seasonStart(year, which);
    return { dn: dayIn(t), name, note: `${extra} · ${de(t)} Uhr deutsche Zeit`, kind: 'season' as const };
  };
  const xmas = fixed(year, 12, 25);
  const advent4 = xmas - (dow(xmas) === 0 ? 7 : dow(xmas));
  const list: Array<Omit<Observance, 'date'>> = [
    { dn: fixed(year, 2, 14), name: 'Valentinstag', note: null, kind: 'tradition' },
    { dn: e - 52, name: 'Weiberfastnacht', note: 'Fastnacht in Mainz', kind: 'tradition' },
    { dn: e - 48, name: 'Rosenmontag', note: 'Rosenmontagszug in Mainz – viele Büros zu', kind: 'tradition' },
    { dn: e - 46, name: 'Aschermittwoch', note: 'Ende der Fastnacht', kind: 'tradition' },
    season('march', 'Frühlingsanfang', 'Tag-und-Nacht-Gleiche'),
    { dn: lastSunday(year, 3), name: 'Zeitumstellung (Sommerzeit)', note: 'Uhren in DE 1 Std. vor · Dubai ist dann 2 Std. voraus', kind: 'clock' },
    { dn: e, name: 'Ostersonntag', note: null, kind: 'tradition' },
    { dn: nthSunday(year, 5, 2), name: 'Muttertag', note: null, kind: 'tradition' },
    { dn: e + 49, name: 'Pfingstsonntag', note: null, kind: 'tradition' },
    season('june', 'Sommeranfang', 'Sommersonnenwende – längster Tag'),
    season('september', 'Herbstanfang', 'Tag-und-Nacht-Gleiche'),
    { dn: lastSunday(year, 10), name: 'Zeitumstellung (Winterzeit)', note: 'Uhren in DE 1 Std. zurück · Dubai ist dann 3 Std. voraus', kind: 'clock' },
    { dn: fixed(year, 10, 31), name: 'Halloween', note: null, kind: 'tradition' },
    { dn: fixed(year, 11, 11), name: 'Martinstag · 11.11.', note: 'Beginn der Fastnachtskampagne (11:11 Uhr)', kind: 'tradition' },
    { dn: advent4 - 21, name: '1. Advent', note: null, kind: 'tradition' },
    { dn: advent4 - 14, name: '2. Advent', note: null, kind: 'tradition' },
    { dn: advent4 - 7, name: '3. Advent', note: null, kind: 'tradition' },
    { dn: advent4, name: '4. Advent', note: null, kind: 'tradition' },
    { dn: fixed(year, 12, 6), name: 'Nikolaus', note: null, kind: 'tradition' },
    season('december', 'Winteranfang', 'Wintersonnenwende – kürzester Tag'),
    { dn: fixed(year, 12, 24), name: 'Heiligabend', note: 'Kein Feiertag – Geschäfte und Ämter in DE meist nur vormittags offen', kind: 'tradition' },
    { dn: fixed(year, 12, 31), name: 'Silvester', note: 'Kein Feiertag – Ämter und Banken in DE meist nur vormittags offen', kind: 'tradition' },
  ];
  return list.map((o) => ({ ...o, date: iso(o.dn) })).sort((a, b) => a.dn - b.dn);
}

export function observancesBetween(fromDn: number, toDn: number): Observance[] {
  const y1 = new Date(fromDn * DAY).getUTCFullYear(), y2 = new Date(toDn * DAY).getUTCFullYear();
  const out: Observance[] = [];
  for (let y = y1; y <= y2; y++) out.push(...observances(y).filter((o) => o.dn >= fromDn && o.dn <= toDn));
  return out;
}
