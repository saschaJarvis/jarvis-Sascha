import SunCalc from 'suncalc';

/**
 * Mond für einen Ort (Standard: Dubai) – Phase, Beleuchtung, Lage am Himmel, Auf-/Untergang,
 * nächster Voll-/Neumond. Rechnet überall gleich (unabhängig von der Zeitzone des Geräts/Servers).
 * Genauigkeit: Auf-/Untergang ca. ±5 Min., Voll-/Neumond ca. ±1 Std. (SunCalc, vereinfachte Mondbahn).
 */

export const DUBAI = { name: 'Dubai', lat: 25.2048, lon: 55.2708, tz: 'Asia/Dubai' } as const;

const H0 = 0.133 * (Math.PI / 180); // Horizont für den Mond (Refraktion/Parallaxe), wie SunCalc
const MIN = 60_000;
const DEG = 180 / Math.PI;

export interface MoonState {
  phase: number;              // 0 = Neumond, 0.5 = Vollmond
  fraction: number;           // beleuchteter Anteil 0..1
  waxing: boolean;
  name: string;
  emoji: string;
  brightLimbFromZenith: number; // rad, gegen den Uhrzeigersinn vom Zenit (für die Darstellung)
  altitudeDeg: number;
  azimuthDeg: number;         // 0 = Nord, 90 = Ost
  direction: string;          // N, NO, O …
  above: boolean;
  riseToday: Date | null;
  setToday: Date | null;
  nextRise: Date | null;
  nextSet: Date | null;
  nextFull: Date;
  nextNew: Date;
}

/** Name der Phase: Voll-/Neumond ±18 Std. um den exakten Zeitpunkt, sonst nach Beleuchtung */
export function describePhase(now: Date, fraction: number, waxing: boolean, fulls: Date[], news: Date[]): { name: string; emoji: string } {
  const near = (ds: Date[]) => ds.some((d) => Math.abs(d.getTime() - now.getTime()) < 18 * 3_600_000);
  if (near(fulls)) return { name: 'Vollmond', emoji: '🌕' };
  if (near(news)) return { name: 'Neumond', emoji: '🌑' };
  if (fraction < 0.4) return waxing ? { name: 'Zunehmende Sichel', emoji: '🌒' } : { name: 'Abnehmende Sichel', emoji: '🌘' };
  if (fraction < 0.6) return waxing ? { name: 'Erstes Viertel', emoji: '🌓' } : { name: 'Letztes Viertel', emoji: '🌗' };
  return waxing ? { name: 'Zunehmender Mond', emoji: '🌔' } : { name: 'Abnehmender Mond', emoji: '🌖' };
}

export function phaseName(p: number): { name: string; emoji: string } {
  if (p < 0.03 || p >= 0.97) return { name: 'Neumond', emoji: '🌑' };
  if (p < 0.22) return { name: 'Zunehmende Sichel', emoji: '🌒' };
  if (p < 0.28) return { name: 'Erstes Viertel', emoji: '🌓' };
  if (p < 0.47) return { name: 'Zunehmender Mond', emoji: '🌔' };
  if (p < 0.53) return { name: 'Vollmond', emoji: '🌕' };
  if (p < 0.72) return { name: 'Abnehmender Mond', emoji: '🌖' };
  if (p < 0.78) return { name: 'Letztes Viertel', emoji: '🌗' };
  return { name: 'Abnehmende Sichel', emoji: '🌘' };
}

const DIRS = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];

/** Mitternacht (lokal in tz) des Tages, in dem `t` liegt */
export function zonedMidnight(t: Date, tz: string): Date {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(t).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = asUtc - Math.floor(t.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset);
}

const alt = (t: number, lat: number, lon: number) => SunCalc.getMoonPosition(new Date(t), lat, lon).altitude - H0;

/** Auf- und Untergänge im Zeitraum (Abtastung 10 Min. + Verfeinerung) */
export function moonCrossings(from: Date, to: Date, lat: number, lon: number): Array<{ kind: 'rise' | 'set'; at: Date }> {
  const out: Array<{ kind: 'rise' | 'set'; at: Date }> = [];
  const step = 10 * MIN;
  let t0 = from.getTime();
  let a0 = alt(t0, lat, lon);
  for (let t1 = t0 + step; t1 <= to.getTime() + 1; t1 += step) {
    const a1 = alt(t1, lat, lon);
    if ((a0 < 0) !== (a1 < 0)) {
      let lo = t0, hi = t1, alo = a0;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2, am = alt(mid, lat, lon);
        if ((am < 0) === (alo < 0)) { lo = mid; alo = am; } else hi = mid;
      }
      out.push({ kind: a0 < 0 ? 'rise' : 'set', at: new Date(Math.round((lo + hi) / 2 / MIN) * MIN) });
    }
    t0 = t1; a0 = a1;
  }
  return out;
}

// ── Voll-/Neumond exakt nach Meeus, Astronomical Algorithms Kap. 49 (Genauigkeit ~1 Min.) ──
const R = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * R);
const NEW_FULL: Array<[number, number, (a: { M: number; Mp: number; F: number; O: number }) => number, number]> = [
  // [Neumond-Koeff., Vollmond-Koeff., Argument, E-Potenz]
  [-0.4072, -0.40614, (a) => a.Mp, 0], [0.17241, 0.17302, (a) => a.M, 1], [0.01608, 0.01614, (a) => 2 * a.Mp, 0],
  [0.01039, 0.01043, (a) => 2 * a.F, 0], [0.00739, 0.00734, (a) => a.Mp - a.M, 1], [-0.00514, -0.00515, (a) => a.Mp + a.M, 1],
  [0.00208, 0.00209, (a) => 2 * a.M, 2], [-0.00111, -0.00111, (a) => a.Mp - 2 * a.F, 0], [-0.00057, -0.00057, (a) => a.Mp + 2 * a.F, 0],
  [0.00056, 0.00056, (a) => 2 * a.Mp + a.M, 1], [-0.00042, -0.00042, (a) => 3 * a.Mp, 0], [0.00042, 0.00042, (a) => a.M + 2 * a.F, 1],
  [0.00038, 0.00038, (a) => a.M - 2 * a.F, 1], [-0.00024, -0.00024, (a) => 2 * a.Mp - a.M, 1], [-0.00017, -0.00017, (a) => a.O, 0],
  [-0.00007, -0.00007, (a) => a.Mp + 2 * a.M, 0], [0.00004, 0.00004, (a) => 2 * a.Mp - 2 * a.F, 0], [0.00004, 0.00004, (a) => 3 * a.M, 0],
  [0.00003, 0.00003, (a) => a.Mp + a.M - 2 * a.F, 0], [0.00003, 0.00003, (a) => 2 * a.Mp + 2 * a.F, 0], [-0.00003, -0.00003, (a) => a.Mp + a.M + 2 * a.F, 0],
  [0.00003, 0.00003, (a) => a.Mp - a.M + 2 * a.F, 0], [-0.00002, -0.00002, (a) => a.Mp - a.M - 2 * a.F, 0], [-0.00002, -0.00002, (a) => 3 * a.Mp + a.M, 0],
  [0.00002, 0.00002, (a) => 4 * a.Mp, 0],
];
const PLANETARY: Array<[number, number, number]> = [
  [0.000325, 299.77, 0.107408], [0.000165, 251.88, 0.016321], [0.000164, 251.83, 26.651886], [0.000126, 349.42, 36.412478],
  [0.00011, 84.66, 18.206239], [0.000062, 141.74, 53.303771], [0.00006, 207.14, 2.453732], [0.000056, 154.84, 7.30686],
  [0.000047, 34.52, 27.261239], [0.000042, 207.19, 0.121824], [0.00004, 291.34, 1.844379], [0.000037, 161.72, 24.198154],
  [0.000035, 239.56, 25.513099], [0.000023, 331.55, 3.592518],
];

/** Exakter Zeitpunkt von Neumond (k ganzzahlig) bzw. Vollmond (k + 0.5) */
export function lunarPhaseTime(k: number): Date {
  const full = Math.abs(k % 1) > 0.25;
  const T = k / 1236.85;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T ** 2 - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T ** 2;
  const a = {
    M: 2.5534 + 29.1053567 * k - 0.0000014 * T ** 2 - 0.00000011 * T ** 3,
    Mp: 201.5643 + 385.81693528 * k + 0.0107582 * T ** 2 + 0.00001238 * T ** 3 - 0.000000058 * T ** 4,
    F: 160.7108 + 390.67050284 * k - 0.0016118 * T ** 2 - 0.00000227 * T ** 3 + 0.000000011 * T ** 4,
    O: 124.7746 - 1.56375588 * k + 0.0020672 * T ** 2 + 0.00000215 * T ** 3,
  };
  for (const [cNew, cFull, arg, ePow] of NEW_FULL) jde += (full ? cFull : cNew) * E ** ePow * sin(arg(a));
  PLANETARY.forEach(([c, a0, a1], i) => { jde += c * sin(a0 + a1 * k - (i === 0 ? 0.009173 * T ** 2 : 0)); });
  return new Date((jde - 2440587.5) * 86_400_000 - 69_000); // TT → UTC
}

/** Nächster Voll- (0.5) bzw. Neumond (0) nach `from` */
export function nextPhase(from: Date, target: 0 | 0.5): Date {
  const y = from.getUTCFullYear() + (from.getTime() - Date.UTC(from.getUTCFullYear(), 0, 1)) / (365.25 * 86_400_000);
  let k = Math.floor((y - 2000) * 12.3685) - 2 + target;
  for (let i = 0; i < 6; i++, k++) { const t = lunarPhaseTime(k); if (t > from) return t; }
  return lunarPhaseTime(k);
}

export function moonState(now: Date, place: { lat: number; lon: number; tz: string } = DUBAI): MoonState {
  const ill = SunCalc.getMoonIllumination(now);
  const pos = SunCalc.getMoonPosition(now, place.lat, place.lon);
  const nextFull = nextPhase(now, 0.5), nextNew = nextPhase(now, 0);
  const prevFull = new Date(nextFull.getTime() - 29.530589 * 86_400_000), prevNew = new Date(nextNew.getTime() - 29.530589 * 86_400_000);
  const waxing = nextFull < nextNew;
  const { name, emoji } = describePhase(now, ill.fraction, waxing, [prevFull, nextFull], [prevNew, nextNew]);
  const azimuthDeg = ((pos.azimuth * DEG + 180) % 360 + 360) % 360;
  const start = zonedMidnight(now, place.tz);
  const end = new Date(start.getTime() + 24 * 3_600_000);
  const today = moonCrossings(start, end, place.lat, place.lon);
  const ahead = moonCrossings(now, new Date(now.getTime() + 50 * 3_600_000), place.lat, place.lon);
  return {
    phase: ill.phase,
    fraction: ill.fraction,
    waxing,
    name, emoji,
    brightLimbFromZenith: ill.angle - pos.parallacticAngle,
    altitudeDeg: pos.altitude * DEG,
    azimuthDeg,
    direction: DIRS[Math.round(azimuthDeg / 45) % 8],
    above: pos.altitude > H0,
    riseToday: today.find((c) => c.kind === 'rise')?.at ?? null,
    setToday: today.find((c) => c.kind === 'set')?.at ?? null,
    nextRise: ahead.find((c) => c.kind === 'rise')?.at ?? null,
    nextSet: ahead.find((c) => c.kind === 'set')?.at ?? null,
    nextFull,
    nextNew,
  };
}

/** Sonnenrichtung im Bild (x rechts, y unten, z zum Betrachter) – für die beleuchtete Seite der Punktkugel */
export function sunVector(m: Pick<MoonState, 'fraction' | 'brightLimbFromZenith'>): [number, number, number] {
  const cosI = 2 * m.fraction - 1;
  const sinI = Math.sqrt(Math.max(0, 1 - cosI * cosI));
  const chi = m.brightLimbFromZenith;
  return [-Math.sin(chi) * sinI, -Math.cos(chi) * sinI, cosI];
}

// ───────────────────────── Sonne ─────────────────────────

export interface SunState {
  up: boolean;
  altitudeDeg: number;
  azimuthDeg: number;
  direction: string;
  sunrise: Date;
  sunset: Date;
  noon: Date;
  dayLengthMin: number;
  nextSunrise: Date;
  nextSunset: Date;
}

const SUN_H0 = -0.833; // Grad: Oberrand am Horizont inkl. Refraktion

export function sunState(now: Date, place: { lat: number; lon: number; tz: string } = DUBAI): SunState {
  const pos = SunCalc.getPosition(now, place.lat, place.lon);
  const noonOf = (d: Date) => new Date(zonedMidnight(d, place.tz).getTime() + 12 * 3_600_000);
  const today = SunCalc.getTimes(noonOf(now), place.lat, place.lon);
  const tomorrow = SunCalc.getTimes(new Date(noonOf(now).getTime() + 86_400_000), place.lat, place.lon);
  const azimuthDeg = ((pos.azimuth * DEG + 180) % 360 + 360) % 360;
  return {
    up: pos.altitude * DEG > SUN_H0,
    altitudeDeg: pos.altitude * DEG,
    azimuthDeg,
    direction: DIRS[Math.round(azimuthDeg / 45) % 8],
    sunrise: today.sunrise,
    sunset: today.sunset,
    noon: today.solarNoon,
    dayLengthMin: Math.round((today.sunset.getTime() - today.sunrise.getTime()) / MIN),
    nextSunrise: now < today.sunrise ? today.sunrise : tomorrow.sunrise,
    nextSunset: now < today.sunset ? today.sunset : tomorrow.sunset,
  };
}

/**
 * Umriss der beleuchteten Mondfläche als SVG-Pfad (Mittelpunkt 0/0, Radius r), beleuchteter Rand zeigt nach +x.
 * Danach um `limbRotationDeg` drehen.
 */
export function litPath(fraction: number, r: number): string {
  const k = Math.min(1, Math.max(0, fraction));
  if (k < 0.005) return '';
  if (k > 0.995) return `M0 ${-r} A${r} ${r} 0 1 1 0 ${r} A${r} ${r} 0 1 1 0 ${-r}Z`;
  const rx = Math.abs(2 * k - 1) * r;
  // rechte Hälfte (Rand), dann Terminator zurück nach oben: Sichel wölbt nach rechts, Dreiviertel nach links
  const sweep = k > 0.5 ? 1 : 0;
  return `M0 ${-r} A${r} ${r} 0 0 1 0 ${r} A${rx.toFixed(3)} ${r} 0 0 ${sweep} 0 ${-r}Z`;
}

/** SVG-Drehwinkel (Grad, im Uhrzeigersinn) von +x zur Richtung des beleuchteten Randes am Himmel */
export function limbRotationDeg(brightLimbFromZenith: number): number {
  const x = -Math.sin(brightLimbFromZenith), y = -Math.cos(brightLimbFromZenith);
  return Math.atan2(y, x) * DEG;
}
