import 'server-only';

/**
 * Kurse für Aktien/ETFs (Yahoo Finance, ohne Schlüssel) und Platin (gold-api.com).
 * Alles wird in EUR umgerechnet; Fremdwährungen über Yahoo-Devisenkurse (z. B. USDEUR=X).
 * Fehlt ein Kurs, wird nichts geschätzt – der Posten gilt als „ohne Kurs“.
 */

import { closeAt, hourlyFactors, rangeFactors, relChange } from '@/lib/domain/change';

const UA = { 'user-agent': 'Mozilla/5.0 (Jarvis read-only)', accept: 'application/json' };
const YAHOO = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

export interface Quote { symbol: string; name: string | null; currency: string; price: number; prevClose: number | null; exchange: string | null; type: string | null; at: Date }

const cache = new Map<string, { at: number; v: unknown }>();
async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const h = cache.get(key);
  if (h && Date.now() - h.at < ttl) return h.v as T;
  const v = await fn();
  cache.set(key, { at: Date.now(), v });
  return v;
}

async function yahoo<T>(path: string, revalidate = 120): Promise<T> {
  let last = 'nicht erreichbar';
  for (const base of YAHOO) {
    try {
      const r = await fetch(`${base}${path}`, { headers: UA, next: { revalidate }, signal: AbortSignal.timeout(7000) });
      if (!r.ok) { last = `HTTP ${r.status}`; continue; }
      return (await r.json()) as T;
    } catch (e) { last = (e as Error).message; }
  }
  throw new Error(`Yahoo ${last}`);
}

interface ChartResp { chart?: { result?: Array<{ meta?: { symbol?: string; currency?: string; regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number; exchangeName?: string; fullExchangeName?: string; instrumentType?: string; longName?: string; shortName?: string; regularMarketTime?: number }; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }>; error?: { description?: string } | null } }

/** Kurs eines Yahoo-Kürzels (null = unbekannt/kein Kurs). */
export async function quote(symbol: string): Promise<Quote | null> {
  return cached(`q:${symbol}`, 60_000, async () => {
    try {
      const j = await yahoo<ChartResp>(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`);
      const res = j.chart?.result?.[0];
      const m = res?.meta;
      if (!m?.regularMarketPrice || !m.currency) return null;
      const closes = (res?.indicators?.quote?.[0]?.close ?? []).filter((x): x is number => typeof x === 'number');
      // Vortagesschluss: vorletzter Tagesschluss (letzter = heute bzw. letzter Handelstag)
      const prev = closes.length >= 2 ? closes[closes.length - 2] : (m.previousClose ?? null);
      return { symbol: m.symbol ?? symbol, name: m.longName ?? m.shortName ?? null, currency: m.currency, price: m.regularMarketPrice, prevClose: prev, exchange: m.fullExchangeName ?? m.exchangeName ?? null, type: m.instrumentType ?? null, at: new Date((m.regularMarketTime ?? Date.now() / 1000) * 1000) };
    } catch (e) { console.error('[aktie]', symbol, (e as Error).message); return null; }
  });
}

/** Ticker, ISIN oder Name → passendes Yahoo-Kürzel (bevorzugt deutsche Börsenplätze in EUR). */
export async function resolveSymbol(input: string): Promise<{ symbol: string; name: string | null; isin: string | null } | null> {
  const q = input.trim();
  const isin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(q.toUpperCase()) ? q.toUpperCase() : null;
  if (!isin && /^[A-Za-z0-9.^=-]{1,20}$/.test(q)) {
    const direct = await quote(q.toUpperCase());
    if (direct) return { symbol: direct.symbol, name: direct.name, isin: null };
  }
  try {
    const j = await yahoo<{ quotes?: Array<{ symbol?: string; shortname?: string; longname?: string; exchange?: string; quoteType?: string }> }>(
      `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`, 3600);
    const list = (j.quotes ?? []).filter((x) => x.symbol && ['EQUITY', 'ETF', 'MUTUALFUND', 'INDEX'].includes(x.quoteType ?? ''));
    if (!list.length) return null;
    const pref = ['GER', 'FRA', 'STU', 'MUN', 'DUS', 'HAM', 'BER'];
    const best = list.find((x) => pref.includes(x.exchange ?? '') && x.quoteType !== 'MUTUALFUND') ?? list.find((x) => x.quoteType !== 'MUTUALFUND') ?? list[0];
    const qq = await quote(best.symbol!);
    if (!qq) return null;
    return { symbol: best.symbol!, name: best.longname ?? best.shortname ?? qq.name, isin };
  } catch (e) { console.error('[aktie] suche', (e as Error).message); return null; }
}

/** EUR je Einheit einer Währung (GBp = Pence). null = kein Kurs. */
export async function eurPer(currency: string): Promise<number | null> {
  const c = currency.trim();
  if (c === 'EUR') return 1;
  if (c === 'GBp' || c === 'GBX') { const g = await eurPer('GBP'); return g == null ? null : g / 100; }
  if (c === 'ZAc' || c === 'ILA') { const base = await eurPer(c === 'ZAc' ? 'ZAR' : 'ILS'); return base == null ? null : base / 100; }
  return cached(`fx:${c}`, 600_000, async () => {
    const q = await quote(`${c.toUpperCase()}EUR=X`);
    return q?.price ?? null;
  });
}

/**
 * gold.de-Kurse (Gold und Silber, je Feinunze in USD und EUR). gold.de hat keine Schnittstelle; die Werte stehen
 * als <data class="au_gold_eur_s">3.566,65</data> in der öffentlichen Kursseite (/kurse/ ist laut robots.txt erlaubt).
 * Abruf höchstens alle 10 Minuten. Platin steht dort nicht im Seitentext – dafür bleibt gold-api.com.
 */
export async function goldDe(): Promise<{ gold: { usd: number; eur: number }; silver: { usd: number; eur: number } } | null> {
  return cached('golde', 600_000, async () => {
    try {
      const r = await fetch('https://www.gold.de/kurse/silberpreis/', { headers: { 'user-agent': 'Mozilla/5.0 (Jarvis; privat, max. 1 Abruf/10 Min.)', accept: 'text/html' }, next: { revalidate: 600 }, signal: AbortSignal.timeout(6000) });
      if (!r.ok) return null;
      const html = await r.text();
      const v = (cls: string) => {
        const m = html.match(new RegExp(`class="${cls}"[^>]*>\\s*([0-9.]+,[0-9]+)`));
        return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : NaN;
      };
      const out = { gold: { usd: v('au_gold_usd_s'), eur: v('au_gold_eur_s') }, silver: { usd: v('au_silber_usd_s'), eur: v('au_silber_eur_s') } };
      const ok = out.gold.eur > 500 && out.gold.usd > 500 && out.silver.eur > 3 && out.silver.usd > 3 && out.silver.eur < 1000;
      if (!ok) { console.error('[gold.de] Seite unerwartet aufgebaut'); return null; }
      return out;
    } catch (e) { console.error('[gold.de]', (e as Error).message); return null; }
  });
}

export type Metal = 'gold' | 'silver' | 'platinum';
const METAL_FUT: Record<Metal, string> = { gold: 'GC=F', silver: 'SI=F', platinum: 'PL=F' };

/**
 * 24-h-Kursänderung eines Edelmetalls (relativ, z. B. 0,012 = +1,2 %). Quelle: Yahoo-Stundenkerzen der COMEX/NYMEX-Futures –
 * die relative Bewegung entspricht dem Spotpreis, der Wert selbst kommt weiter von gold.de / gold-api.com. null = nicht abrufbar.
 */
export async function metalChange24h(metal: Metal): Promise<number | null> {
  return (await metalTrend(metal)).change;
}

/** 24-h-Änderung und Stundenverlauf (Faktoren relativ zu jetzt) eines Edelmetalls. */
export async function metalTrend(metal: Metal): Promise<{ change: number | null; spark: number[] | null }> {
  return cached(`m24:${metal}`, 120_000, async () => {
    try {
      const j = await yahoo<ChartResp & { chart?: { result?: Array<{ timestamp?: number[] }> } }>(`/v8/finance/chart/${encodeURIComponent(METAL_FUT[metal])}?range=5d&interval=60m`);
      const res = j.chart?.result?.[0] as (NonNullable<NonNullable<ChartResp['chart']>['result']>[number] & { timestamp?: number[] }) | undefined;
      const now = res?.meta?.regularMarketPrice;
      const ts = res?.timestamp ?? [];
      const closes = res?.indicators?.quote?.[0]?.close ?? [];
      if (!now || !ts.length) return { change: null, spark: null };
      const nowSec = Math.floor(Date.now() / 1000);
      return { change: relChange(now, closeAt(ts, closes, nowSec - 86_400)), spark: hourlyFactors(ts, closes, now, nowSec) };
    } catch (e) { console.error('[metall 24h]', metal, (e as Error).message); return { change: null, spark: null }; }
  });
}

export interface MetalPrice { usdPerOz: number; eurPerOz?: number | null; source: string }

/** Silber je Feinunze: gold.de (EUR), Ausweich gold-api.com (USD). */
export async function silverPrice(): Promise<MetalPrice | null> {
  const g = await goldDe();
  if (g) return { usdPerOz: g.silver.usd, eurPerOz: g.silver.eur, source: 'gold.de' };
  try {
    const r = await fetch('https://api.gold-api.com/price/XAG', { next: { revalidate: 600 }, signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const j = (await r.json()) as { price?: number };
      if (typeof j.price === 'number' && j.price > 3) return { usdPerOz: j.price, source: 'gold-api.com' };
    }
  } catch { /* kein Preis */ }
  return null;
}

/** Platin in USD je Feinunze (gold-api.com). */
export async function platinumPrice(): Promise<MetalPrice | null> {
  try {
    const r = await fetch('https://api.gold-api.com/price/XPT', { next: { revalidate: 600 }, signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const j = (await r.json()) as { price?: number };
      if (typeof j.price === 'number' && j.price > 100) return { usdPerOz: j.price, source: 'gold-api.com' };
    }
  } catch { /* kein Preis */ }
  return null;
}

export type HistRange = '7d' | '1m' | '1y';
export const RANGE_CFG: Record<HistRange, { span: number; points: number; yahoo: string; kraken: number; geckoDays: number; ttl: number }> = {
  '7d': { span: 7 * 86_400, points: 57, yahoo: 'range=1mo&interval=60m', kraken: 60, geckoDays: 7, ttl: 900 },
  '1m': { span: 30 * 86_400, points: 61, yahoo: 'range=3mo&interval=60m', kraken: 240, geckoDays: 30, ttl: 3600 },
  '1y': { span: 365 * 86_400, points: 92, yahoo: 'range=1y&interval=1d', kraken: 1440, geckoDays: 365, ttl: 21_600 },
};

/** Verlauf eines Edelmetalls über 7 Tage / 1 Monat / 1 Jahr als Faktoren relativ zu jetzt (Yahoo-Futures). */
export async function metalHistory(metal: Metal, range: HistRange): Promise<number[] | null> {
  const c = RANGE_CFG[range];
  return cached(`mh:${metal}:${range}`, c.ttl * 1000, async () => {
    try {
      const j = await yahoo<ChartResp & { chart?: { result?: Array<{ timestamp?: number[] }> } }>(`/v8/finance/chart/${encodeURIComponent(METAL_FUT[metal])}?${c.yahoo}`, c.ttl);
      const res = j.chart?.result?.[0] as (NonNullable<NonNullable<ChartResp['chart']>['result']>[number] & { timestamp?: number[] }) | undefined;
      const now = res?.meta?.regularMarketPrice;
      const ts = res?.timestamp ?? [];
      const closes = res?.indicators?.quote?.[0]?.close ?? [];
      if (!now || !ts.length) return null;
      return rangeFactors(ts, closes, now, Math.floor(Date.now() / 1000), c.span, c.points);
    } catch (e) { console.error('[metall verlauf]', metal, range, (e as Error).message); return null; }
  });
}
