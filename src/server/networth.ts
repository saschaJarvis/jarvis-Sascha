import 'server-only';
import { db } from './repo';
import type { Session } from './auth';
import { getFx } from './ext';
import { coinPrices, loadAdaAccount, loadAlgoAccount, loadBtcAccount, loadEthAccount, loadXrpAccount, WALLETS_SQL, type Coin } from './wallets';
import { goldValueUsd, sumParts, toAed, AED_PER_USD } from '@/lib/domain/networth';
import { portfolioChange } from '@/lib/domain/change';

const fake = () => process.env.CRYPTO_FAKE === '1' && process.env.AUTH_PROVIDER !== 'supabase';

export interface GoldPrice { usdPerOz: number; source: string }

/** Goldpreis (USD je Feinunze): gold-api.com, Ausweich PAX Gold über CoinGecko (1 PAXG = 1 oz). */
export async function goldPrice(): Promise<GoldPrice | null> {
  if (fake()) return { usdPerOz: 3110.34768, source: 'Test' };
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

export interface AccountRow { id: string; name: string; institution: string | null; currency: string; kind: string; amount_minor: string | null; as_of: string | null }
export interface GoldRow { id: string; label: string; grams: string; purity: number; form: string }

export interface NetWorth {
  eurAed: number | null;
  totalAed: number;
  totalEur: number | null;
  missing: number;                       // Posten ohne Kurs (nicht mitgezählt)
  accounts: { aed: number; count: number; rows: Array<AccountRow & { aed: number | null }> };
  crypto: {
    aed: number; count: number; holdings: Partial<Record<string, number>>; error: boolean;
    change: { aed: number; eur: number | null; pct: number | null; complete: boolean } | null;
    coins: Array<{ coin: Coin; amount: number; aed: number; eur: number; priceEur: number; priceAed: number; changePct: number | null; changeAed: number | null; source: string }>;
    asOf: Date;
  };
  gold: { aed: number; count: number; grams: number; price: GoldPrice | null; rows: Array<GoldRow & { aed: number | null }> };
}

export async function loadNetWorth(s: Session): Promise<NetWorth> {
  const [rows, fx] = await Promise.all([
    db(s).run(async (q) => ({
      accounts: await q<AccountRow>(`select a.id, a.name, a.institution, a.currency, a.kind, b.amount_minor::text, b.as_of::text
          from accounts a left join lateral (select amount_minor, as_of from balances where account_id = a.id order by as_of desc, created_at desc limit 1) b on true
          where a.deleted_at is null and not a.is_demo and a.kind <> 'crypto_wallet' order by a.created_at`),
      wallets: await q<{ chain: Coin; address: string }>(WALLETS_SQL),
      gold: await q<GoldRow>(`select id, label, grams::text, purity, form from gold_holdings where deleted_at is null order by created_at`),
    })),
    getFx(),
  ]);
  const eurAed = fx?.eurAed ?? null;

  const accRows = rows.accounts.map((a) => ({ ...a, aed: a.amount_minor == null ? 0 : toAed(Number(a.amount_minor) / 100, a.currency, eurAed) }));
  const acc = sumParts(accRows.map((a) => a.aed));

  const chains = [...new Set(rows.wallets.map((w) => w.chain))];
  const [views, prices] = await Promise.all([
    Promise.all(rows.wallets.map(async (w) => {
      if (w.chain === 'algo') {
        const a = await loadAlgoAccount(w.address);
        return { error: !!a.error, native: { coin: 'algo' as Coin, amount: a.algo }, stable: a.tokens.reduce((n, t) => n + t.amount, 0), tokens: a.tokens };
      }
      if (w.chain === 'ada') {
        const a = await loadAdaAccount(w.address);
        return { error: !!a.error, native: { coin: 'ada' as Coin, amount: a.ada }, stable: 0, tokens: [] as Array<{ symbol: string; amount: number }> };
      }
      if (w.chain === 'btc') {
        const a = await loadBtcAccount(w.address);
        return { error: !!a.error, native: { coin: 'btc' as Coin, amount: a.btc }, stable: 0, tokens: [] as Array<{ symbol: string; amount: number }> };
      }
      if (w.chain === 'eth') {
        const a = await loadEthAccount(w.address);
        return { error: !!a.error, native: { coin: 'eth' as Coin, amount: a.eth }, stable: a.tokens.reduce((n, t) => n + (Number.isFinite(t.amount) ? t.amount : 0), 0), tokens: a.tokens };
      }
      const a = await loadXrpAccount(w.address);
      return { error: !!a.error, native: { coin: 'xrp' as Coin, amount: a.xrp }, stable: 0, tokens: [] as Array<{ symbol: string; amount: number }> };
    })),
    coinPrices(chains),
  ]);
  const holdings: Partial<Record<string, number>> = {};
  const cryptoVals = views.map((v) => {
    const sym = v.native.coin.toUpperCase();
    holdings[sym] = (holdings[sym] ?? 0) + (Number.isFinite(v.native.amount) ? v.native.amount : 0); // auch 0 zeigen
    for (const t of v.tokens) if (Number.isFinite(t.amount)) holdings[t.symbol] = (holdings[t.symbol] ?? 0) + t.amount;
    const p = prices[v.native.coin];
    if (v.error || !p) return null;
    return v.native.amount * p.aed + v.stable * AED_PER_USD;
  });
  const crypto = sumParts(cryptoVals);
  // 24-h-Veränderung: Kurswert je Coin mit seiner Änderung; Stablecoins ohne Änderung
  const perCoin: Partial<Record<Coin, { amount: number; aed: number; eur: number }>> = {};
  const changeItems = views.flatMap((v) => {
    const p = prices[v.native.coin];
    if (v.error || !p) return [];
    const pc = (perCoin[v.native.coin] ??= { amount: 0, aed: 0, eur: 0 });
    pc.amount += v.native.amount; pc.aed += v.native.amount * p.aed; pc.eur += v.native.amount * p.eur;
    return [{ valueNow: v.native.amount * p.aed, change: p.change24h }, ...(v.stable ? [{ valueNow: v.stable * AED_PER_USD, change: 0 }] : [])];
  });
  const ch = portfolioChange(changeItems);
  const coins = (Object.entries(perCoin) as Array<[Coin, { amount: number; aed: number; eur: number }]>).map(([coin, v]) => {
    const p = prices[coin]!;
    const c = portfolioChange([{ valueNow: v.aed, change: p.change24h }]);
    return { coin, amount: v.amount, aed: v.aed, eur: v.eur, priceEur: p.eur, priceAed: p.aed, changePct: p.change24h, changeAed: p.change24h == null ? null : c.abs, source: p.source };
  });
  const gp = rows.gold.length ? await goldPrice() : null;
  const goldRows = rows.gold.map((g) => ({ ...g, aed: gp ? goldValueUsd(Number(g.grams), g.purity, gp.usdPerOz) * AED_PER_USD : null }));
  const gold = sumParts(goldRows.map((g) => g.aed));

  const total = sumParts([acc.aed, crypto.aed, gold.aed]);
  const missing = acc.missing + gold.missing + crypto.missing;
  return {
    eurAed, totalAed: total.aed, totalEur: eurAed ? total.aed / eurAed : null, missing,
    accounts: { aed: acc.aed, count: accRows.length, rows: accRows },
    crypto: {
      aed: crypto.aed, count: rows.wallets.length, holdings, error: crypto.missing > 0, coins, asOf: new Date(),
      change: changeItems.length ? { aed: ch.abs, eur: eurAed ? ch.abs / eurAed : null, pct: ch.pct, complete: ch.complete } : null,
    },
    gold: { aed: gold.aed, count: rows.gold.length, grams: rows.gold.reduce((n, g) => n + Number(g.grams), 0), price: gp, rows: goldRows },
  };
}
