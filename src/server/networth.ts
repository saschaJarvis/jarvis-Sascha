import 'server-only';
import { db } from './repo';
import type { Session } from './auth';
import { getFx, type Fx } from './ext';
import { coinPrices, loadAdaAccount, loadAlgoAccount, loadBtcAccount, loadEthAccount, loadXrpAccount, loadZecAccount, loadAtomAccount, loadXlmAccount, loadLtcAccount, loadDotAccount, loadVetAccount, loadSolAccount, WALLETS_SQL, MANUAL_SQL, MANUAL_SYMBOLS, type ManualRow, type Coin, type PriceCoin } from './wallets';
import { goldValueUsd, sumParts, toAed, AED_PER_USD } from '@/lib/domain/networth';
import { portfolioChange, valueSeries } from '@/lib/domain/change';
import { eurPer, goldDe, metalTrend, platinumPrice, quote, silverPrice, type MetalPrice } from './markets';

const fake = () => process.env.CRYPTO_FAKE === '1' && process.env.AUTH_PROVIDER !== 'supabase';

export type GoldPrice = MetalPrice;

/** Goldpreis je Feinunze: gold.de (EUR + USD), Ausweich gold-api.com, dann PAX Gold über CoinGecko (1 PAXG = 1 oz). */
export async function goldPrice(): Promise<GoldPrice | null> {
  if (fake()) return { usdPerOz: 3110.34768, source: 'Test' };
  const gd = await goldDe();
  if (gd) return { usdPerOz: gd.gold.usd, eurPerOz: gd.gold.eur, source: 'gold.de' };
  try {
    const r = await fetch('https://api.gold-api.com/price/XAU', { next: { revalidate: 600 }, signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const j = (await r.json()) as { price?: number };
      if (typeof j.price === 'number' && j.price > 100) return { usdPerOz: j.price, source: 'gold-api.com' };
    }
  } catch { /* Ausweich */ }
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=pax-gold&vs_currencies=usd', { next: { revalidate: 600 }, signal: AbortSignal.timeout(4000) });
    const j = (await r.json()) as { 'pax-gold'?: { usd?: number } };
    const p = j['pax-gold']?.usd;
    if (typeof p === 'number' && p > 100) return { usdPerOz: p, source: 'CoinGecko (PAX Gold)' };
  } catch { /* kein Preis */ }
  return null;
}

export type MetalRowView = GoldRow & { aed: number | null; costEur: number | null };
/** pieces = Summe der Stückzahlen (ohne Stückzahl zählt eine Position als 1); cost = Kaufpreise in EUR, soweit bekannt */
export interface MetalBlock { aed: number; count: number; pieces: number; grams: number; price: GoldPrice | null; rows: MetalRowView[]; cost: { eur: number; valueEur: number; rows: number } | null;
  /** 24-h-Veränderung des Bestands (Kursbewegung × Menge); null = keine Bestände mit Kurs */
  change: { aed: number; eur: number | null; pct: number | null; complete: boolean } | null;
  /** Wert der letzten 24 h in AED, stündlich (25 Punkte, letzter = jetzt); null = kein Verlauf */
  series: number[] | null }

export interface AccountRow { id: string; name: string; institution: string | null; currency: string; kind: string; amount_minor: string | null; as_of: string | null }
export interface GoldRow { id: string; label: string; grams: string; purity: number; form: string; metal: 'gold' | 'platinum' | 'silver'; pieces: number | null; purchase_total: string | null; purchase_currency: string | null; purchased_on: string | null; dealer: string | null; invoice_no: string | null; document_id: string | null; version_id: string | null }
export interface StockRow { id: string; symbol: string; name: string | null; isin: string | null; quantity: string; label: string; venue: string | null }

export interface NetWorth {
  eurAed: number | null;
  fx: Fx | null;                         // Kursquelle für die Anzeige (live oder EZB)
  totalAed: number;
  totalEur: number | null;
  missing: number;                       // Posten ohne Kurs (nicht mitgezählt)
  accounts: { aed: number; count: number; rows: Array<AccountRow & { aed: number | null }> };
  crypto: {
    aed: number; count: number; holdings: Partial<Record<string, number>>; error: boolean;
    change: { aed: number; eur: number | null; pct: number | null; complete: boolean } | null;
    series: number[] | null;              // Wert der letzten 24 h in AED, stündlich
    coins: Array<{ coin: PriceCoin; amount: number; aed: number; eur: number; priceEur: number; priceAed: number; changePct: number | null; changeAed: number | null; source: string }>;
    asOf: Date;
  };
  gold: MetalBlock;
  platinum: MetalBlock;
  silver: MetalBlock;
  stocks: {
    aed: number; count: number; error: boolean;
    change: { aed: number; eur: number | null; pct: number | null; complete: boolean } | null;
    rows: Array<StockRow & { price: number | null; currency: string | null; eur: number | null; aed: number | null; changePct: number | null; exchange: string | null }>;
  };
}

/** Bestand einer Wallet: Hauptwährung + Tokens. price 'usd' = Stablecoin (1 USD). */
export type Asset = { symbol: string; amount: number; price: PriceCoin | 'usd' };
export async function walletAssets(w: { chain: Coin; address: string }): Promise<{ error: boolean; assets: Asset[] }> {
  if (w.chain === 'algo') {
    const a = await loadAlgoAccount(w.address);
    return { error: !!a.error, assets: [{ symbol: 'ALGO', amount: a.algo, price: 'algo' as const }, ...a.tokens.map((t) => ({ ...t, price: 'usd' as const }))] };
  }
  if (w.chain === 'sol') { const a = await loadSolAccount(w.address); return { error: !!a.error, assets: [{ symbol: 'SOL', amount: a.sol, price: 'sol' as const }, ...a.tokens] }; }
  if (w.chain === 'vet') { const a = await loadVetAccount(w.address); return { error: !!a.error, assets: [{ symbol: 'VET', amount: a.vet, price: 'vet' as const }] }; }
  if (w.chain === 'dot') { const a = await loadDotAccount(w.address); return { error: !!a.error, assets: [{ symbol: 'DOT', amount: a.dot, price: 'dot' as const }] }; }
  if (w.chain === 'ltc') { const a = await loadLtcAccount(w.address); return { error: !!a.error, assets: [{ symbol: 'LTC', amount: a.ltc, price: 'ltc' as const }] }; }
  if (w.chain === 'xlm') { const a = await loadXlmAccount(w.address); return { error: !!a.error, assets: [{ symbol: 'XLM', amount: a.xlm, price: 'xlm' as const }, ...a.tokens.map((t) => ({ ...t, price: 'usd' as const }))] }; }
  if (w.chain === 'atom') { const a = await loadAtomAccount(w.address); return { error: !!a.error, assets: [{ symbol: 'ATOM', amount: a.atom, price: 'atom' as const }] }; }
  if (w.chain === 'zec') { const a = await loadZecAccount(w.address); return { error: !!a.error, assets: [{ symbol: 'ZEC', amount: a.zec, price: 'zec' as const }] }; }
  if (w.chain === 'ada') { const a = await loadAdaAccount(w.address); return { error: !!a.error, assets: [{ symbol: 'ADA', amount: a.ada, price: 'ada' as const }] }; }
  if (w.chain === 'btc') { const a = await loadBtcAccount(w.address); return { error: !!a.error, assets: [{ symbol: 'BTC', amount: a.btc, price: 'btc' as const }] }; }
  if (w.chain === 'eth') { const a = await loadEthAccount(w.address); return { error: !!a.error, assets: [{ symbol: 'ETH', amount: a.eth, price: 'eth' as const }, ...a.tokens] }; }
  const a = await loadXrpAccount(w.address);
  return { error: !!a.error, assets: [{ symbol: 'XRP', amount: a.xrp, price: 'xrp' as const }] };
}

export async function loadNetWorth(s: Session): Promise<NetWorth> {
  const [rows, fx] = await Promise.all([
    db(s).run(async (q) => ({
      accounts: await q<AccountRow>(`select a.id, a.name, a.institution, a.currency, a.kind, b.amount_minor::text, b.as_of::text
          from accounts a left join lateral (select amount_minor, as_of from balances where account_id = a.id order by as_of desc, created_at desc limit 1) b on true
          where a.deleted_at is null and not a.is_demo and a.kind <> 'crypto_wallet' order by a.created_at`),
      wallets: await q<{ chain: Coin; address: string }>(WALLETS_SQL),
      gold: await q<GoldRow>(`select g.id, g.label, g.grams::text, g.purity, g.form, g.metal, g.pieces, g.purchase_total::text, g.purchase_currency, g.purchased_on::text, g.dealer, g.invoice_no, g.document_id,
        (select v.id from document_versions v where v.document_id = g.document_id order by v.version_no desc limit 1) version_id
      from gold_holdings g where g.deleted_at is null order by g.purchased_on nulls last, g.created_at`),
      stocks: await q<StockRow>(`select id, symbol, name, isin, quantity::text, label, venue from stock_holdings where deleted_at is null order by created_at`),
      manual: await q<ManualRow>(MANUAL_SQL),
    })),
    getFx(),
  ]);
  const eurAed = fx?.eurAed ?? null;

  const accRows = rows.accounts.map((a) => ({ ...a, aed: a.amount_minor == null ? 0 : toAed(Number(a.amount_minor) / 100, a.currency, eurAed) }));
  const acc = sumParts(accRows.map((a) => a.aed));

  const views = [
    ...(await Promise.all(rows.wallets.map(walletAssets))),
    // Von Hand gepflegte Bestände (z. B. Bitpanda) – zum aktuellen Kurs
    ...rows.manual.filter((m) => MANUAL_SYMBOLS[m.symbol]).map((m) => ({ error: false, assets: [{ symbol: m.symbol, amount: Number(m.amount), price: MANUAL_SYMBOLS[m.symbol] } as Asset] })),
  ];
  const needed = [...new Set(views.flatMap((v) => v.assets.map((x) => x.price)).filter((p): p is PriceCoin => p !== 'usd'))];
  const prices = await coinPrices(needed);
  const priceAed = (x: Asset) => (x.price === 'usd' ? AED_PER_USD : prices[x.price]?.aed ?? null);

  const holdings: Partial<Record<string, number>> = {};
  const cryptoVals = views.map((v) => {
    let sum = 0;
    for (const x of v.assets) {
      const ok = Number.isFinite(x.amount);
      if (x.price !== 'usd' || ok) holdings[x.symbol] = (holdings[x.symbol] ?? 0) + (ok ? x.amount : 0); // Hauptwährung auch mit 0 zeigen
    }
    if (v.error) return null;
    for (const x of v.assets) {
      if (!Number.isFinite(x.amount)) continue;
      const pa = priceAed(x);
      if (pa == null) return null;
      sum += x.amount * pa;
    }
    return sum;
  });
  const crypto = sumParts(cryptoVals);
  // 24-h-Veränderung: Kurswert je Coin mit seiner Änderung; Stablecoins ohne Änderung
  const perCoin: Partial<Record<PriceCoin, { amount: number; aed: number; eur: number }>> = {};
  const changeItems = views.flatMap((v) => (v.error ? [] : v.assets.flatMap((x) => {
    if (!Number.isFinite(x.amount) || x.amount === 0 && x.price === 'usd') return [];
    if (x.price === 'usd') return [{ valueNow: x.amount * AED_PER_USD, change: 0, factors: null }];
    const p = prices[x.price];
    if (!p) return [];
    const pc = (perCoin[x.price] ??= { amount: 0, aed: 0, eur: 0 });
    pc.amount += x.amount; pc.aed += x.amount * p.aed; pc.eur += x.amount * p.eur;
    return [{ valueNow: x.amount * p.aed, change: p.change24h, factors: p.spark ?? null }];
  })));
  const cryptoSeries = changeItems.some((i) => i.factors) ? valueSeries(changeItems) : null;
  const ch = portfolioChange(changeItems);
  const coins = (Object.entries(perCoin) as Array<[PriceCoin, { amount: number; aed: number; eur: number }]>).map(([coin, v]) => {
    const p = prices[coin]!;
    const c = portfolioChange([{ valueNow: v.aed, change: p.change24h }]);
    return { coin, amount: v.amount, aed: v.aed, eur: v.eur, priceEur: p.eur, priceAed: p.aed, changePct: p.change24h, changeAed: p.change24h == null ? null : c.abs, source: p.source };
  });
  const goldOnly = rows.gold.filter((g) => (g.metal ?? 'gold') === 'gold');
  const platOnly = rows.gold.filter((g) => g.metal === 'platinum');
  const silvOnly = rows.gold.filter((g) => g.metal === 'silver');
  const [gp, pp, sp, gc, pc, sc] = await Promise.all([goldPrice(), platinumPrice(), silverPrice(), metalTrend('gold'), metalTrend('platinum'), metalTrend('silver')]);
  // Wert: Feinunzen × Kurs – in EUR (gold.de) wenn vorhanden, sonst USD
  const metalAed = (g: GoldRow, p: GoldPrice | null) => !p ? null
    : p.eurPerOz && eurAed ? (goldValueUsd(Number(g.grams), g.purity, p.eurPerOz) * eurAed) : goldValueUsd(Number(g.grams), g.purity, p.usdPerOz) * AED_PER_USD;
  const goldRows = goldOnly.map((g) => ({ ...g, aed: metalAed(g, gp) }));
  const gold = sumParts(goldRows.map((g) => g.aed));
  const platRows = platOnly.map((g) => ({ ...g, aed: metalAed(g, pp) }));
  const plat = sumParts(platRows.map((g) => g.aed));
  const silvRows = silvOnly.map((g) => ({ ...g, aed: metalAed(g, sp) }));
  const silv = sumParts(silvRows.map((g) => g.aed));

  // Aktien/ETFs: Kurs (Yahoo) × Stück, in EUR umgerechnet, dann AED
  const stockRows = await Promise.all(rows.stocks.map(async (r) => {
    const q = await quote(r.symbol);
    const fx = q ? await eurPer(q.currency) : null;
    const eur = q && fx != null ? Number(r.quantity) * q.price * fx : null;
    return {
      ...r, price: q?.price ?? null, currency: q?.currency ?? null, exchange: q?.exchange ?? null, eur,
      aed: eur != null && eurAed ? eur * eurAed : null,
      changePct: q?.prevClose ? q.price / q.prevClose - 1 : null,
    };
  }));
  const stocks = sumParts(stockRows.map((r) => r.aed));
  const stockCh = portfolioChange(stockRows.filter((r) => r.aed != null).map((r) => ({ valueNow: r.aed!, change: r.changePct })));

  const total = sumParts([acc.aed, crypto.aed, gold.aed, plat.aed, silv.aed, stocks.aed]);
  const missing = acc.missing + gold.missing + crypto.missing + plat.missing + silv.missing + stocks.missing;
  return {
    eurAed, fx: fx ?? null, totalAed: total.aed, totalEur: eurAed ? total.aed / eurAed : null, missing,
    accounts: { aed: acc.aed, count: accRows.length, rows: accRows },
    crypto: {
      aed: crypto.aed, count: rows.wallets.length + rows.manual.length, holdings, error: crypto.missing > 0, coins, asOf: new Date(), series: cryptoSeries,
      change: changeItems.length ? { aed: ch.abs, eur: eurAed ? ch.abs / eurAed : null, pct: ch.pct, complete: ch.complete } : null,
    },
    gold: await metalBlock(goldOnly, goldRows, gold.aed, gp, eurAed, gc),
    platinum: await metalBlock(platOnly, platRows, plat.aed, pp, eurAed, pc),
    silver: await metalBlock(silvOnly, silvRows, silv.aed, sp, eurAed, sc),
    stocks: {
      aed: stocks.aed, count: rows.stocks.length, error: stocks.missing > 0, rows: stockRows,
      change: stockRows.some((r) => r.aed != null) ? { aed: stockCh.abs, eur: eurAed ? stockCh.abs / eurAed : null, pct: stockCh.pct, complete: stockCh.complete } : null,
    },
  };
}

async function metalBlock(src: GoldRow[], rows: Array<GoldRow & { aed: number | null }>, aed: number, price: GoldPrice | null, eurAed: number | null, trend: { change: number | null; spark: number[] | null }): Promise<MetalBlock> {
  const change24h = trend.change;
  const fx = new Map<string, number | null>();
  const view: MetalRowView[] = [];
  for (const r of rows) {
    let costEur: number | null = null;
    if (r.purchase_total != null) {
      const cur = (r.purchase_currency ?? 'EUR').trim().toUpperCase();
      if (!fx.has(cur)) fx.set(cur, cur === 'EUR' ? 1 : cur === 'AED' ? (eurAed ? 1 / eurAed : null) : await eurPer(cur));
      const f = fx.get(cur);
      costEur = f != null ? Number(r.purchase_total) * f : null;
    }
    view.push({ ...r, costEur });
  }
  const withCost = view.filter((r) => r.costEur != null && r.aed != null);
  const valued = rows.filter((r) => r.aed != null);
  const ch = portfolioChange(valued.map((r) => ({ valueNow: r.aed!, change: change24h })));
  return {
    aed, count: src.length, pieces: src.reduce((n, g) => n + (g.pieces ?? 1), 0), grams: src.reduce((n, g) => n + Number(g.grams), 0), price, rows: view,
    cost: withCost.length && eurAed ? { eur: withCost.reduce((n, r) => n + r.costEur!, 0), valueEur: withCost.reduce((n, r) => n + r.aed! / eurAed, 0), rows: withCost.length } : null,
    change: valued.length && change24h != null ? { aed: ch.abs, eur: eurAed ? ch.abs / eurAed : null, pct: change24h, complete: ch.complete } : null,
    series: valued.length && trend.spark ? valueSeries([{ valueNow: aed, factors: trend.spark }]) : null,
  };
}
