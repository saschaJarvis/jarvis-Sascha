import 'server-only';
import { rangeFactors } from '@/lib/domain/change';
import { GECKO, KRAKEN_PAIR, type PriceCoin } from './wallets';
import { RANGE_CFG, type HistRange } from './markets';

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
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${GECKO[coin]}/market_chart?vs_currency=eur&days=${c.geckoDays}`, { next: { revalidate: c.ttl }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { prices?: Array<[number, number]> };
    const p = j.prices ?? [];
    if (!p.length) return null;
    return rangeFactors(p.map((x) => Math.floor(x[0] / 1000)), p.map((x) => x[1]), p[p.length - 1][1], nowSec, c.span, c.points);
  } catch { return null; }
}
