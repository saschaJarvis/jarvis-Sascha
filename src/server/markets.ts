import 'server-only';

/**
 * Kurse für Aktien/ETFs (Yahoo Finance, ohne Schlüssel) und Platin (gold-api.com).
 * Alles wird in EUR umgerechnet; Fremdwährungen über Yahoo-Devisenkurse (z. B. USDEUR=X).
 * Fehlt ein Kurs, wird nichts geschätzt – der Posten gilt als „ohne Kurs“.
 */

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

/** Platin in USD je Feinunze (gold-api.com). */
export async function platinumPrice(): Promise<{ usdPerOz: number; source: string } | null> {
  try {
    const r = await fetch('https://api.gold-api.com/price/XPT', { next: { revalidate: 600 }, signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const j = (await r.json()) as { price?: number };
      if (typeof j.price === 'number' && j.price > 100) return { usdPerOz: j.price, source: 'gold-api.com' };
    }
  } catch { /* kein Preis */ }
  return null;
}
