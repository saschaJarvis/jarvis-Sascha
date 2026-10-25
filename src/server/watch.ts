import 'server-only';
import { withService } from './db';
import { goldPrice, walletAssets, type Asset } from './networth';
import { eurPer, platinumPrice, quote } from './markets';
import { goldValueUsd } from '@/lib/domain/networth';
import { coinPrices, MANUAL_SYMBOLS, type Coin, type PriceCoin } from './wallets';
import { AED_PER_USD } from '@/lib/domain/networth';
import { getFx } from './ext';
import { dispatchAlerts, queueAlert } from './notify';

/**
 * Wächter (alle 5 Minuten über /api/cron/watch):
 *  - Abfluss: Bestand einer Wallet sinkt → sofort, kritisch (auch in der Ruhezeit).
 *  - Eingang: Bestand steigt um mindestens 25 € Gegenwert.
 *  - Kurs: eigener Krypto-Bestand bewegt sich seit Tagesbeginn (Dubai) um ≥ Schwelle (Standard 10 %) – nur Kurse,
 *    Ein-/Auszahlungen zählen nicht mit. Je Tag und Richtung höchstens einmal.
 * Fehlerhafte Abrufe (Netz nicht erreichbar) werden übersprungen – nie als Abfluss gewertet.
 */

const TABLE: Record<Coin, string> = {
  xrp: 'crypto_wallets', eth: 'eth_wallets', btc: 'btc_wallets', ada: 'ada_wallets', algo: 'algo_wallets', zec: 'zec_wallets',
  atom: 'atom_wallets', xlm: 'xlm_wallets', ltc: 'ltc_wallets', dot: 'dot_wallets', vet: 'vet_wallets', sol: 'sol_wallets',
};
const userWalletsSql = Object.entries(TABLE)
  .map(([chain, t]) => `select id, '${chain}'::text chain, address, label from ${t} where deleted_at is null and user_id = $1`).join(' union all ');

const INFLOW_MIN_EUR = 25;
const OUTFLOW_MIN_EUR = 1;
const nf = (n: number, d = 2) => n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: d });
const dec = (sym: string) => (['BTC', 'ZEC', 'LTC', 'ETH'].includes(sym) ? 6 : 2);

export async function runWatch(): Promise<{ users: number; alerts: number; sent: number; failed: number }> {
  const users = await withService((q) => q<{ user_id: string; kinds: Record<string, boolean>; price_threshold_pct: string; other_threshold_pct: string; price_anchor: Record<string, number> | null; price_anchor_day: string | null; timezone: string }>(
    `select s.user_id, s.kinds, s.price_threshold_pct::text, s.other_threshold_pct::text, s.price_anchor, s.price_anchor_day::text, p.timezone
       from alert_settings s join profiles p on p.id = s.user_id
      where (s.push_enabled or s.telegram_chat_id is not null) and not coalesce(p.kill_switch, false)`));
  const fx = await getFx();
  const eurAed = fx?.eurAed ?? null;
  let alerts = 0;

  for (const u of users) {
    const wallets = await withService((q) => q<{ id: string; chain: Coin; address: string; label: string }>(userWalletsSql, [u.user_id]));
    // Aktien & Edelmetalle (Wert in EUR je Posten, Kurs als Anker-Schlüssel)
    const others = await otherHoldings(u.user_id, eurAed);
    if (!wallets.length && !others.length && !(await withService((q) => q('select 1 from manual_crypto where deleted_at is null and user_id = $1 limit 1', [u.user_id]))).length) continue;
    const views = await Promise.all(wallets.map(async (w) => ({ w, v: await walletAssets(w).catch(() => ({ error: true, assets: [] as Asset[] })) })));
    // Von Hand gepflegte Bestände (z. B. Bitpanda): nur für die Kurswarnung, nicht für Ab-/Zuflüsse
    const manual = await withService((q) => q<{ symbol: string; amount: string }>('select symbol, amount::text from manual_crypto where deleted_at is null and user_id = $1', [u.user_id]));
    const manualAssets: Asset[] = manual.filter((m) => MANUAL_SYMBOLS[m.symbol]).map((m) => ({ symbol: m.symbol, amount: Number(m.amount), price: MANUAL_SYMBOLS[m.symbol] }));
    const needed = [...new Set([...views.flatMap((x) => x.v.assets), ...manualAssets].map((a) => a.price).filter((p): p is PriceCoin => p !== 'usd'))];
    const prices = await coinPrices(needed);
    const eurOf = (a: { price: PriceCoin | 'usd' }) => (a.price === 'usd' ? (eurAed ? AED_PER_USD / eurAed : null) : prices[a.price]?.eur ?? null);

    // ---------- Ab- und Zuflüsse je Wallet ----------
    const snaps = await withService((q) => q<{ wallet_key: string; symbol: string; amount: string }>('select wallet_key, symbol, amount::text from wallet_snapshots where user_id = $1', [u.user_id]));
    const prev = new Map(snaps.map((s) => [`${s.wallet_key}|${s.symbol}`, Number(s.amount)]));
    for (const { w, v } of views) {
      if (v.error) continue;
      const key = `${w.chain}:${w.id}`;
      for (const a of v.assets) {
        if (!Number.isFinite(a.amount)) continue;
        const before = prev.get(`${key}|${a.symbol}`);
        await withService((q) => q(`insert into wallet_snapshots (user_id, wallet_key, symbol, amount, label) values ($1, $2, $3, $4, $5)
            on conflict (user_id, wallet_key, symbol) do update set amount = excluded.amount, label = excluded.label, updated_at = now()`,
          [u.user_id, key, a.symbol, a.amount.toFixed(12), w.label]));
        if (before === undefined) continue; // erster Lauf: nur merken
        const delta = a.amount - before;
        if (Math.abs(delta) < 1e-9) continue;
        const p = eurOf(a);
        const eur = p != null ? Math.abs(delta) * p : null;
        const dir = delta < 0 ? 'outflow' : 'inflow';
        if (!u.kinds?.[dir]) continue;
        if (dir === 'outflow' && eur != null && eur < OUTFLOW_MIN_EUR) continue;
        if (dir === 'inflow' && (eur == null || eur < INFLOW_MIN_EUR)) continue;
        const amountTxt = `${nf(Math.abs(delta), dec(a.symbol))} ${a.symbol}${eur != null ? ` (≈ ${nf(eur, 0)} €)` : ''}`;
        const ok = await queueAlert(u.user_id, dir === 'outflow'
          ? { kind: 'outflow', severity: 'critical', title: `Abfluss: ${amountTxt}`, url: '/leben/finanzen',
              body: `Von „${w.label}“ sind gerade ${amountTxt} abgegangen. Neuer Stand: ${nf(a.amount, dec(a.symbol))} ${a.symbol}.\nWarst du das nicht? Sofort in Ledger Live prüfen – und niemals deine 24 Wörter irgendwo eingeben.`,
              dedupKey: `out:${key}:${a.symbol}:${a.amount.toFixed(8)}` }
          : { kind: 'inflow', severity: 'info', title: `Eingang: ${amountTxt}`, url: '/leben/finanzen',
              body: `Auf „${w.label}“ sind ${amountTxt} eingegangen. Neuer Stand: ${nf(a.amount, dec(a.symbol))} ${a.symbol}.`,
              dedupKey: `in:${key}:${a.symbol}:${a.amount.toFixed(8)}` });
        if (ok) alerts++;
      }
    }

    // ---------- Kursbewegung seit Tagesbeginn ----------
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: u.timezone || 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const nowPrices: Record<string, number> = Object.fromEntries(Object.entries(prices).map(([k, p]) => [k, p!.eur]));
    for (const o of others) nowPrices[o.key] = o.price;
    const anchor = { ...(u.price_anchor ?? {}) };
    // Neu hinzugekommene Posten bekommen ihren Anker sofort, ohne bis morgen zu warten
    const fresh = others.filter((o) => anchor[o.key] == null);
    if (u.price_anchor_day !== day || !u.price_anchor) {
      await withService((q) => q('update alert_settings set price_anchor = $2, price_anchor_day = $3 where user_id = $1', [u.user_id, JSON.stringify(nowPrices), day]));
    } else {
      if (fresh.length) {
        for (const o of fresh) anchor[o.key] = o.price;
        await withService((q) => q('update alert_settings set price_anchor = $2 where user_id = $1', [u.user_id, JSON.stringify(anchor)]));
      }
      if (u.kinds?.other !== false && others.length) {
        let then = 0, now = 0;
        for (const o of others) { const p0 = anchor[o.key]; if (!p0 || !o.price) continue; now += o.eur; then += o.eur * (p0 / o.price); }
        const th = Number(u.other_threshold_pct ?? 5) / 100;
        if (then > 0) {
          const ch = now / then - 1;
          if (Math.abs(ch) >= th) {
            const up = ch > 0;
            const ok = await queueAlert(u.user_id, {
              kind: 'price', severity: up ? 'info' : 'warn', url: '/leben/finanzen',
              title: `Aktien & Edelmetalle ${up ? '▲ +' : '▼ −'}${nf(Math.abs(ch) * 100, 1)} % heute`,
              body: `Aktien, Gold und Platin zusammen seit heute früh: ${nf(then, 0)} € → ${nf(now, 0)} € (${up ? '+' : '−'}${nf(Math.abs(now - then), 0)} €). Nur Kursbewegung.`,
              dedupKey: `other:${day}:${up ? 'up' : 'down'}`,
            });
            if (ok) alerts++;
          }
        }
      }
    }
    if (u.price_anchor_day === day && u.price_anchor && u.kinds?.price) {
      let then = 0, now = 0;
      for (const v of [...views.map((x) => x.v), { error: false, assets: manualAssets }]) {
        if (v.error) continue;
        for (const a of v.assets) {
          if (a.price === 'usd' || !Number.isFinite(a.amount)) continue;
          const p0 = u.price_anchor[a.price], p1 = nowPrices[a.price];
          if (!p0 || !p1) continue;
          then += a.amount * p0; now += a.amount * p1;
        }
      }
      const th = Number(u.price_threshold_pct) / 100;
      if (then > 0) {
        const ch = now / then - 1;
        if (Math.abs(ch) >= th) {
          const up = ch > 0;
          const ok = await queueAlert(u.user_id, {
            kind: 'price', severity: up ? 'info' : 'warn', url: '/leben/finanzen',
            title: `Krypto ${up ? '▲ +' : '▼ −'}${nf(Math.abs(ch) * 100, 1)} % heute`,
            body: `Dein Krypto-Bestand ist seit heute früh ${up ? 'gestiegen' : 'gefallen'}: ${nf(then, 0)} € → ${nf(now, 0)} € (${up ? '+' : '−'}${nf(Math.abs(now - then), 0)} €). Nur Kursbewegung, Ein- und Auszahlungen nicht mitgerechnet.`,
            dedupKey: `price:${day}:${up ? 'up' : 'down'}`,
          });
          if (ok) alerts++;
        }
      }
    }
  }
  const d = await dispatchAlerts();
  return { users: users.length, alerts, ...d };
}

/** Aktien/ETFs, Gold und Platin eines Nutzers: Anker-Schlüssel, aktueller Kurs (Originalwährung) und Wert in EUR. */
async function otherHoldings(userId: string, eurAed: number | null): Promise<Array<{ key: string; price: number; eur: number }>> {
  const [metals, stocks] = await Promise.all([
    withService((q) => q<{ grams: string; purity: number; metal: string }>('select grams::text, purity, metal from gold_holdings where deleted_at is null and user_id = $1', [userId])),
    withService((q) => q<{ symbol: string; quantity: string }>('select symbol, quantity::text from stock_holdings where deleted_at is null and user_id = $1', [userId])),
  ]);
  const out: Array<{ key: string; price: number; eur: number }> = [];
  const usdEur = eurAed ? AED_PER_USD / eurAed : null;
  for (const metal of ['gold', 'platinum'] as const) {
    const rows = metals.filter((m) => (m.metal ?? 'gold') === metal);
    if (!rows.length || !usdEur) continue;
    const p = await (metal === 'gold' ? goldPrice() : platinumPrice()).catch(() => null);
    if (!p) continue;
    const usd = rows.reduce((n, r) => n + goldValueUsd(Number(r.grams), r.purity, p.usdPerOz), 0);
    out.push({ key: `metal:${metal}`, price: p.usdPerOz, eur: usd * usdEur });
  }
  const bySym = new Map<string, number>();
  for (const s of stocks) bySym.set(s.symbol, (bySym.get(s.symbol) ?? 0) + Number(s.quantity));
  for (const [sym, qty] of bySym) {
    const q = await quote(sym);
    const fx = q ? await eurPer(q.currency) : null;
    if (!q || fx == null) continue;
    out.push({ key: `stock:${sym}`, price: q.price, eur: qty * q.price * fx });
  }
  return out;
}
