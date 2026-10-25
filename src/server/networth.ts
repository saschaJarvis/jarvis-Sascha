import 'server-only';
import { db } from './repo';
import type { Session } from './auth';
import { getFx } from './ext';
import { loadXrpAccount, xrpPrice } from './wallets';
import { goldValueUsd, sumParts, toAed, AED_PER_USD } from '@/lib/domain/networth';

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
  crypto: { aed: number; count: number; xrp: number; priceAed: number | null; error: boolean };
  gold: { aed: number; count: number; grams: number; price: GoldPrice | null; rows: Array<GoldRow & { aed: number | null }> };
}

export async function loadNetWorth(s: Session): Promise<NetWorth> {
  const [rows, fx] = await Promise.all([
    db(s).run(async (q) => ({
      accounts: await q<AccountRow>(`select a.id, a.name, a.institution, a.currency, a.kind, b.amount_minor::text, b.as_of::text
          from accounts a left join lateral (select amount_minor, as_of from balances where account_id = a.id order by as_of desc, created_at desc limit 1) b on true
          where a.deleted_at is null and not a.is_demo and a.kind <> 'crypto_wallet' order by a.created_at`),
      wallets: await q<{ address: string }>(`select address from crypto_wallets where deleted_at is null`),
      gold: await q<GoldRow>(`select id, label, grams::text, purity, form from gold_holdings where deleted_at is null order by created_at`),
    })),
    getFx(),
  ]);
  const eurAed = fx?.eurAed ?? null;

  const accRows = rows.accounts.map((a) => ({ ...a, aed: a.amount_minor == null ? 0 : toAed(Number(a.amount_minor) / 100, a.currency, eurAed) }));
  const acc = sumParts(accRows.map((a) => a.aed));

  const [xrpAccs, price] = await Promise.all([Promise.all(rows.wallets.map((w) => loadXrpAccount(w.address))), rows.wallets.length ? xrpPrice() : null]);
  const xrp = xrpAccs.reduce((n, a) => n + (Number.isFinite(a.xrp) ? a.xrp : 0), 0);
  const cryptoErr = xrpAccs.some((a) => a.error);
  const cryptoAed = rows.wallets.length ? (price ? xrp * price.aed : null) : 0;

  const gp = rows.gold.length ? await goldPrice() : null;
  const goldRows = rows.gold.map((g) => ({ ...g, aed: gp ? goldValueUsd(Number(g.grams), g.purity, gp.usdPerOz) * AED_PER_USD : null }));
  const gold = sumParts(goldRows.map((g) => g.aed));

  const total = sumParts([acc.aed, cryptoAed, gold.aed]);
  const missing = acc.missing + gold.missing + (cryptoAed == null ? 1 : 0) + (cryptoErr ? 1 : 0);
  return {
    eurAed, totalAed: total.aed, totalEur: eurAed ? total.aed / eurAed : null, missing,
    accounts: { aed: acc.aed, count: accRows.length, rows: accRows },
    crypto: { aed: cryptoAed ?? 0, count: rows.wallets.length, xrp, priceAed: price?.aed ?? null, error: cryptoErr || cryptoAed == null },
    gold: { aed: gold.aed, count: rows.gold.length, grams: rows.gold.reduce((n, g) => n + Number(g.grams), 0), price: gp, rows: goldRows },
  };
}
