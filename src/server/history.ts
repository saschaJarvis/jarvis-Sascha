import 'server-only';
import { rangeFactors } from '@/lib/domain/change';
import { GECKO, KRAKEN_PAIR, type PriceCoin } from './wallets';
import { RANGE_CFG, type HistRange } from './markets';
import { AED_PER_USD } from './ext';

/**
 * Kursverlauf eines Coins über 7 Tage / 1 Monat / 1 Jahr als Faktoren relativ zum letzten Kurs.
 * Quelle: Kraken-Kerzen (EUR), Ausweich CoinGecko. null = kein Verlauf.
 */
export async function coinHistory(coin: PriceCoin, range: HistRange): Promise<number[] | null> {
  const c = RANGE_CFG[range];
  const nowSec = Math.floor(Date.now() / 1000);
  const pair = KRAKEN_PAIR[coin];
  if (pair) {
    try {
      const r = await fetch(`https://api.kraken.com/0/public/OHLC?pair=${pair}EUR&interval=${c.kraken}`, { next: { revalidate: c.ttl }, signal: AbortSignal.timeout(6000) });
      const j = (await r.json()) as { result?: Record<string, unknown> };
      const candles = Object.entries(j.result ?? {}).find(([k]) => k !== 'last')?.[1] as Array<[number, string, string, string, string]> | undefined;
      if (candles?.length) {
        const closes = candles.map((k) => Number(k[4]));
        const f = rangeFactors(candles.map((k) => k[0]), closes, closes[closes.length - 1], nowSec, c.span, c.points);
        if (f) return f;
      }
    } catch { /* Ausweich */ }
  }
  if (!c.geckoDays) return null;
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${GECKO[coin]}/market_chart?vs_currency=eur&days=${c.geckoDays}`, { next: { revalidate: c.ttl }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { prices?: Array<[number, number]> };
    const p = j.prices ?? [];
    if (!p.length) return null;
    return rangeFactors(p.map((x) => Math.floor(x[0] / 1000)), p.map((x) => x[1]), p[p.length - 1][1], nowSec, c.span, c.points);
  } catch { return null; }
}

/** €/AED-Verlauf (absolute Kurse) aus Kraken EUR/USD × feste AED-Bindung. Letzter Punkt = aktueller Kurs. */
export async function fxHistory(range: '24h' | HistRange): Promise<number[] | null> {
  const c = range === '24h' ? { span: 86_400, points: 49, kraken: 15, ttl: 120 } : RANGE_CFG[range];
  try {
    const r = await fetch(`https://api.kraken.com/0/public/OHLC?pair=EURUSD&interval=${c.kraken}`, { next: { revalidate: c.ttl }, signal: AbortSignal.timeout(6000) });
    const j = (await r.json()) as { result?: Record<string, unknown> };
    const candles = Object.entries(j.result ?? {}).find(([k]) => k !== 'last')?.[1] as Array<[number, string, string, string, string]> | undefined;
    if (!candles?.length) return null;
    const closes = candles.map((k) => Number(k[4]));
    const now = closes[closes.length - 1];
    if (!(now > 0.8 && now < 1.6)) return null;
    const f = rangeFactors(candles.map((k) => k[0]), closes, now, Math.floor(Date.now() / 1000), c.span, c.points);
    return f ? f.map((x) => Math.round(x * now * AED_PER_USD * 10_000) / 10_000) : null;
  } catch { return null; }
}
