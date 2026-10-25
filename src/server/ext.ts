import 'server-only';

/**
 * Öffentliche Umgebungsdaten für die Kopfzeile – keine personenbezogenen Daten werden gesendet.
 * Wetter: Open-Meteo (ohne Schlüssel). Kurs: EZB-Referenzkurs EUR→USD (Frankfurter-API) × feste AED-Bindung 3,6725.
 * Alles 30 Min. zwischengespeichert; bei Ausfall erscheint „–“ statt einer geratenen Zahl.
 */

const PLACES = {
  dubai: { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
  mainz: { name: 'Mainz', lat: 49.9929, lon: 8.2473 },
} as const;

export interface Weather { place: string; tempC: number; label: string }
export interface Fx { eurAed: number; date: string; source: string }

const WMO: Array<[number[], string]> = [
  [[0], 'Klar'], [[1, 2], 'Heiter'], [[3], 'Bewölkt'], [[45, 48], 'Nebel'], [[51, 53, 55, 56, 57], 'Niesel'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Regen'], [[71, 73, 75, 77, 85, 86], 'Schnee'], [[95, 96, 99], 'Gewitter'],
];

export async function getWeather(timezone: string): Promise<Weather | null> {
  const p = timezone === 'Asia/Dubai' ? PLACES.dubai : PLACES.mainz;
  try {
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=temperature_2m,weather_code&timezone=auto`,
      { next: { revalidate: 1800 }, signal: AbortSignal.timeout(2500) });
    if (!r.ok) return null;
    const j = (await r.json()) as { current?: { temperature_2m?: number; weather_code?: number } };
    if (typeof j.current?.temperature_2m !== 'number') return null;
    const code = j.current.weather_code ?? -1;
    return { place: p.name, tempC: Math.round(j.current.temperature_2m), label: WMO.find(([c]) => c.includes(code))?.[1] ?? '' };
  } catch {
    return null;
  }
}

/** Der Dirham ist seit 1997 fest an den US-Dollar gebunden (1 USD = 3,6725 AED, CBUAE). */
export const AED_PER_USD = 3.6725;

export async function getFx(): Promise<Fx | null> {
  for (const url of ['https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD', 'https://api.frankfurter.app/latest?from=EUR&to=USD']) {
    try {
      const r = await fetch(url, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(2500) });
      if (!r.ok) continue;
      const j = (await r.json()) as { date?: string; rates?: { USD?: number } };
      if (typeof j.rates?.USD !== 'number' || !j.date) continue;
      return { eurAed: Math.round(j.rates.USD * AED_PER_USD * 10_000) / 10_000, date: j.date, source: 'EZB-Referenzkurs × AED-Bindung' };
    } catch { /* nächste Quelle */ }
  }
  return null;
}
