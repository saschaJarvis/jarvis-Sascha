import 'server-only';
import { DROPS_PER_XRP, toMove, type XrpMove } from '@/lib/crypto/xrp';
import { balanceOfData, ETH_TOKENS, fromUnits } from '@/lib/crypto/eth';
import { SATS_PER_BTC } from '@/lib/crypto/btc';
import { AED_PER_USD } from './ext';

/**
 * Krypto – NUR ANSEHEN. Jarvis kennt ausschließlich öffentliche Adressen und fragt öffentliche
 * Ledger-Knoten ab. Es gibt keinen Code-Pfad zum Signieren oder Versenden; Schlüssel, Seeds oder
 * PINs werden nie angenommen.
 */

const XRPL_NODES = ['https://xrplcluster.com/', 'https://s2.ripple.com:51234/'];
const fake = () => process.env.CRYPTO_FAKE === '1' && process.env.AUTH_PROVIDER !== 'supabase';

export interface XrpAccount {
  address: string;
  activated: boolean;
  xrp: number;            // Gesamtbestand
  reserveXrp: number | null; // gesperrte Mindestreserve laut Ledger (Basis + Objekte)
  moves: XrpMove[];
  error?: string;
}
export interface Price { eur: number; usd: number; aed: number; source: string; at: Date }

const cache = new Map<string, { at: number; v: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const v = await fn();
  cache.set(key, { at: Date.now(), v });
  return v;
}

async function rpc(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  let last = 'nicht erreichbar';
  for (const url of XRPL_NODES) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ method, params: [params] }), signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) { last = `HTTP ${r.status}`; continue; }
      const j = (await r.json()) as { result?: Record<string, unknown> };
      if (!j.result) { last = 'leere Antwort'; continue; }
      return j.result;
    } catch (e) { last = (e as Error).message; }
  }
  throw new Error(last);
}

async function reserves(): Promise<{ base: number; owner: number } | null> {
  return cached('xrpl:reserve', 3_600_000, async () => {
    const r = await rpc('server_state', {});
    const v = (r.state as { validated_ledger?: { reserve_base?: number; reserve_inc?: number } } | undefined)?.validated_ledger;
    return v?.reserve_base != null && v.reserve_inc != null ? { base: v.reserve_base / DROPS_PER_XRP, owner: v.reserve_inc / DROPS_PER_XRP } : null;
  }).catch(() => null);
}

export async function loadXrpAccount(address: string): Promise<XrpAccount> {
  if (fake()) {
    return { address, activated: true, xrp: 1234.5, reserveXrp: 1,
      moves: [{ hash: 'TEST', date: new Date(Date.now() - 86_400_000), direction: 'in', xrp: 250, counterparty: 'rTestAbsender', type: 'Payment', fee: 0 }] };
  }
  return cached(`xrp:${address}`, 120_000, async () => {
    try {
      const info = await rpc('account_info', { account: address, ledger_index: 'validated' });
      if (info.error === 'actNotFound') return { address, activated: false, xrp: 0, reserveXrp: null, moves: [] };
      if (info.error) throw new Error(String(info.error_message ?? info.error));
      const data = info.account_data as { Balance: string; OwnerCount?: number };
      const [txs, res] = await Promise.all([
        rpc('account_tx', { account: address, ledger_index_min: -1, ledger_index_max: -1, limit: 15, forward: false }).catch(() => null),
        reserves(),
      ]);
      const list = (txs?.transactions as Array<{ tx?: Record<string, unknown>; tx_json?: Record<string, unknown>; meta?: Record<string, unknown>; hash?: string; close_time_iso?: string }> | undefined) ?? [];
      const moves = list.map((t) => {
        const tx = { ...(t.tx ?? t.tx_json ?? {}), hash: t.hash ?? (t.tx ?? t.tx_json)?.hash };
        const m = toMove(address, tx, t.meta);
        if (m.date.getTime() === 0 && t.close_time_iso) m.date = new Date(t.close_time_iso);
        return m;
      });
      return {
        address, activated: true, xrp: Number(data.Balance) / DROPS_PER_XRP,
        reserveXrp: res ? res.base + res.owner * (data.OwnerCount ?? 0) : null, moves,
      };
    } catch (e) {
      console.error('[xrp]', (e as Error).message);
      return { address, activated: true, xrp: NaN, reserveXrp: null, moves: [], error: 'XRP Ledger gerade nicht erreichbar.' };
    }
  });
}

export type Coin = 'xrp' | 'eth' | 'btc';

/** Alle Wallets des Nutzers (je Kette eine Tabelle, nur öffentliche Adressen). */
export const WALLETS_SQL = `select id, chain, address, label, created_at from (
  select id, 'xrp'::text as chain, address, label, created_at from crypto_wallets where deleted_at is null
  union all select id, 'eth'::text, address, label, created_at from eth_wallets where deleted_at is null
  union all select id, 'btc'::text, address, label, created_at from btc_wallets where deleted_at is null) w order by created_at`;
const GECKO: Record<Coin, string> = { xrp: 'ripple', eth: 'ethereum', btc: 'bitcoin' };
const KRAKEN: Record<Coin, string> = { xrp: 'XRP', eth: 'ETH', btc: 'XBT' };

/** Kurse: CoinGecko (eine Abfrage für alle), Ausweich Kraken. AED über die feste USD-Bindung. */
export async function coinPrices(coins: readonly Coin[] = ['xrp', 'eth', 'btc']): Promise<Partial<Record<Coin, Price>>> {
  if (fake()) return { xrp: { eur: 2, usd: 2.2, aed: 2.2 * AED_PER_USD, source: 'Test', at: new Date() }, eth: { eur: 3000, usd: 3300, aed: 3300 * AED_PER_USD, source: 'Test', at: new Date() }, btc: { eur: 90000, usd: 100000, aed: 100000 * AED_PER_USD, source: 'Test', at: new Date() } };
  const out: Partial<Record<Coin, Price>> = {};
  if (!coins.length) return out;
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coins.map((c) => GECKO[c]).join(',')}&vs_currencies=eur,usd`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const j = (await r.json()) as Record<string, { eur?: number; usd?: number }>;
      for (const c of coins) { const v = j[GECKO[c]]; if (v?.eur && v.usd) out[c] = { eur: v.eur, usd: v.usd, aed: v.usd * AED_PER_USD, source: 'CoinGecko', at: new Date() }; }
    }
  } catch { /* Ausweich */ }
  for (const c of coins.filter((x) => !out[x])) {
    try {
      const k = KRAKEN[c];
      const r = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${k}EUR,${k}USD`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(4000) });
      const j = (await r.json()) as { result?: Record<string, { c?: [string] }> };
      const pick = (re: RegExp) => Number(Object.entries(j.result ?? {}).find(([key]) => re.test(key))?.[1].c?.[0]);
      const eur = pick(/EUR$/), usd = pick(/USD$/);
      if (eur > 0 && usd > 0) out[c] = { eur, usd, aed: usd * AED_PER_USD, source: 'Kraken', at: new Date() };
    } catch { /* kein Kurs */ }
  }
  return out;
}

export async function xrpPrice(): Promise<Price | null> {
  return (await coinPrices(['xrp'])).xrp ?? null;
}

// ---------- Ethereum ----------
const ETH_NODES = ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'];

async function ethRpc(method: string, params: unknown[]): Promise<string> {
  let last = 'nicht erreichbar';
  for (const url of ETH_NODES) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' }, cache: 'no-store',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) { last = `HTTP ${r.status}`; continue; }
      const j = (await r.json()) as { result?: string; error?: { message?: string } };
      if (typeof j.result === 'string') return j.result;
      last = j.error?.message ?? 'leere Antwort';
    } catch (e) { last = (e as Error).message; }
  }
  throw new Error(last);
}

export interface EthAccount { address: string; eth: number; tokens: Array<{ symbol: string; amount: number }>; error?: string }

export async function loadEthAccount(address: string): Promise<EthAccount> {
  if (fake()) return { address, eth: 1.5, tokens: [{ symbol: 'USDC', amount: 500 }] };
  return cached(`eth:${address.toLowerCase()}`, 120_000, async () => {
    try {
      const [wei, ...tok] = await Promise.all([
        ethRpc('eth_getBalance', [address, 'latest']),
        ...ETH_TOKENS.map((t) => ethRpc('eth_call', [{ to: t.contract, data: balanceOfData(address) }, 'latest']).catch(() => null)),
      ]);
      return {
        address, eth: fromUnits(wei, 18),
        tokens: ETH_TOKENS.map((t, i) => ({ symbol: t.symbol, amount: tok[i] ? fromUnits(tok[i]!, t.decimals) : NaN })).filter((t) => t.amount !== 0),
      };
    } catch (e) {
      console.error('[eth]', (e as Error).message);
      return { address, eth: NaN, tokens: [], error: 'Ethereum-Netz gerade nicht erreichbar.' };
    }
  });
}

// ---------- Bitcoin ----------
const BTC_APIS = ['https://mempool.space/api', 'https://blockstream.info/api'];

export interface BtcMove { txid: string; date: Date | null; btc: number; confirmed: boolean }
export interface BtcAccount { address: string; btc: number; pendingBtc: number; txCount: number; moves: BtcMove[]; error?: string }

interface EsploraAddr { chain_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number }; mempool_stats: { funded_txo_sum: number; spent_txo_sum: number } }
interface EsploraTx { txid: string; status: { confirmed: boolean; block_time?: number }; vin: Array<{ prevout?: { scriptpubkey_address?: string; value: number } }>; vout: Array<{ scriptpubkey_address?: string; value: number }> }

export async function loadBtcAccount(address: string): Promise<BtcAccount> {
  if (fake()) return { address, btc: 0.25, pendingBtc: 0, txCount: 3, moves: [{ txid: 'TESTBTC', date: new Date(Date.now() - 3 * 86_400_000), btc: 0.25, confirmed: true }] };
  for (const base of BTC_APIS) {
    try {
      const [ar, tr] = await Promise.all([
        fetch(`${base}/address/${address}`, { next: { revalidate: 120 }, signal: AbortSignal.timeout(6000) }),
        fetch(`${base}/address/${address}/txs`, { next: { revalidate: 120 }, signal: AbortSignal.timeout(6000) }),
      ]);
      if (!ar.ok) continue;
      const a = (await ar.json()) as EsploraAddr;
      const txs = tr.ok ? ((await tr.json()) as EsploraTx[]) : [];
      const moves = txs.slice(0, 15).map((t) => {
        const inn = t.vout.filter((o) => o.scriptpubkey_address === address).reduce((n, o) => n + o.value, 0);
        const out = t.vin.filter((i) => i.prevout?.scriptpubkey_address === address).reduce((n, i) => n + (i.prevout?.value ?? 0), 0);
        return { txid: t.txid, date: t.status.block_time ? new Date(t.status.block_time * 1000) : null, btc: (inn - out) / SATS_PER_BTC, confirmed: t.status.confirmed };
      });
      return {
        address,
        btc: (a.chain_stats.funded_txo_sum - a.chain_stats.spent_txo_sum) / SATS_PER_BTC,
        pendingBtc: (a.mempool_stats.funded_txo_sum - a.mempool_stats.spent_txo_sum) / SATS_PER_BTC,
        txCount: a.chain_stats.tx_count, moves,
      };
    } catch (e) { console.error('[btc]', base, (e as Error).message); }
  }
  return { address, btc: NaN, pendingBtc: 0, txCount: 0, moves: [], error: 'Bitcoin-Netz gerade nicht erreichbar.' };
}
