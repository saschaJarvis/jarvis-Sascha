import 'server-only';
import { DROPS_PER_XRP, toMove, type XrpMove } from '@/lib/crypto/xrp';
import { balanceOfData, decodeAbiString, ETH_TOKENS, fromUnits } from '@/lib/crypto/eth';
import { SATS_PER_BTC } from '@/lib/crypto/btc';
import { ZAT_PER_ZEC } from '@/lib/crypto/zec';
import { LOVELACE_PER_ADA, stakeAddressOf } from '@/lib/crypto/ada';
import { ALGO_STABLES, MICRO_PER_ALGO } from '@/lib/crypto/algo';
import { priceAgo, relChange } from '@/lib/domain/change';
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
export interface Price { eur: number; usd: number; aed: number; source: string; at: Date; change24h: number | null } // change24h: relativ, z. B. 0,023

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

export type Coin = 'xrp' | 'eth' | 'btc' | 'ada' | 'algo' | 'zec';
/** Kurs-Kürzel: Ketten + Tokens mit eigenem Kurs (z. B. Quant auf Ethereum) */
export type PriceCoin = Coin | 'qnt';

/** Alle Wallets des Nutzers (je Kette eine Tabelle, nur öffentliche Adressen). */
export const WALLETS_SQL = `select id, chain, address, label, created_at from (
  select id, 'xrp'::text as chain, address, label, created_at from crypto_wallets where deleted_at is null
  union all select id, 'eth'::text, address, label, created_at from eth_wallets where deleted_at is null
  union all select id, 'btc'::text, address, label, created_at from btc_wallets where deleted_at is null
  union all select id, 'ada'::text, address, label, created_at from ada_wallets where deleted_at is null
  union all select id, 'algo'::text, address, label, created_at from algo_wallets where deleted_at is null
  union all select id, 'zec'::text, address, label, created_at from zec_wallets where deleted_at is null) w order by created_at`;
const GECKO: Record<PriceCoin, string> = { xrp: 'ripple', eth: 'ethereum', btc: 'bitcoin', ada: 'cardano', algo: 'algorand', zec: 'zcash', qnt: 'quant-network' };

const KRAKEN_PAIR: Record<PriceCoin, string> = { btc: 'XBT', eth: 'ETH', xrp: 'XRP', ada: 'ADA', algo: 'ALGO', zec: 'ZEC', qnt: 'QNT' };
const PRICE_TTL = 20; // Sekunden – „quasi Echtzeit“; Kraken erlaubt ~1 Abfrage/s je IP

/**
 * Kurse fast in Echtzeit von Kraken (regulierte Börse, öffentlicher Kurs-Feed, ohne Schlüssel):
 * letzter Handelspreis in EUR und USD, dazu die 24-h-Veränderung aus Stundenkerzen.
 * Ausweich: CoinGecko (Durchschnitt mehrerer Börsen, inkl. 24-h-Änderung). AED über die USD-Bindung.
 */
export async function coinPrices(coins: readonly PriceCoin[] = ['xrp', 'eth', 'btc', 'ada', 'algo', 'zec', 'qnt']): Promise<Partial<Record<PriceCoin, Price>>> {
  if (fake()) {
    const t = (eur: number, usd: number, change24h: number) => ({ eur, usd, aed: usd * AED_PER_USD, source: 'Test', at: new Date(), change24h });
    return { xrp: t(2, 2.2, 0.1), eth: t(3000, 3300, -0.02), btc: t(90000, 100000, 0.01), ada: t(0.6, 0.7, 0), algo: t(0.2, 0.22, 0.05), zec: t(40, 44, 0.02), qnt: t(80, 90, -0.03) };
  }
  const out: Partial<Record<PriceCoin, Price>> = {};
  if (!coins.length) return out;
  try {
    const pairs = coins.flatMap((c) => [`${KRAKEN_PAIR[c]}EUR`, `${KRAKEN_PAIR[c]}USD`]).join(',');
    const r = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pairs}`, { next: { revalidate: PRICE_TTL }, signal: AbortSignal.timeout(4000) });
    const j = (await r.json()) as { error?: string[]; result?: Record<string, { c?: [string]; altname?: string }> };
    const entries = Object.entries(j.result ?? {});
    // Kraken liefert Schlüssel wie XXBTZEUR/XETHZEUR/ADAEUR – über Basis-Kürzel und Quote zuordnen
    const find = (c: PriceCoin, q: 'EUR' | 'USD') => {
      const base = KRAKEN_PAIR[c];
      const e = entries.find(([k]) => k.endsWith(q) && (k.startsWith(base) || k.startsWith(`X${base}`)));
      const v = Number(e?.[1].c?.[0]);
      return Number.isFinite(v) && v > 0 ? { key: e![0], v } : null;
    };
    await Promise.all(coins.map(async (c) => {
      const eur = find(c, 'EUR'), usd = find(c, 'USD');
      if (!eur || !usd) return;
      let change24h: number | null = null;
      try {
        const o = await fetch(`https://api.kraken.com/0/public/OHLC?pair=${eur.key}&interval=60`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(4000) });
        const oj = (await o.json()) as { result?: Record<string, unknown> };
        const candles = Object.entries(oj.result ?? {}).find(([k]) => k !== 'last')?.[1] as Array<[number, string, string, string, string]> | undefined;
        if (candles) change24h = relChange(eur.v, priceAgo(candles, Math.floor(Date.now() / 1000)));
      } catch { /* ohne 24-h-Änderung */ }
      out[c] = { eur: eur.v, usd: usd.v, aed: usd.v * AED_PER_USD, source: 'Kraken', at: new Date(), change24h };
    }));
  } catch (e) { console.error('[kurs] kraken', (e as Error).message); }

  const missing = coins.filter((x) => !out[x]);
  if (missing.length) {
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${missing.map((c) => GECKO[c]).join(',')}&vs_currencies=eur,usd&include_24hr_change=true`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const j = (await r.json()) as Record<string, { eur?: number; usd?: number; eur_24h_change?: number }>;
        for (const c of missing) {
          const v = j[GECKO[c]];
          if (v?.eur && v.usd) out[c] = { eur: v.eur, usd: v.usd, aed: v.usd * AED_PER_USD, source: 'CoinGecko', at: new Date(), change24h: typeof v.eur_24h_change === 'number' ? v.eur_24h_change / 100 : null };
        }
      }
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

/** Betriebscheck: symbol() eines Token-Vertrags abfragen (bestätigt die hinterlegte Vertragsadresse). */
export async function ethTokenSymbol(contract: string): Promise<string | null> {
  try { return decodeAbiString(await ethRpc('eth_call', [{ to: contract, data: '0x95d89b41' }, 'latest'])); } catch { return null; }
}

export interface EthAccount { address: string; eth: number; tokens: Array<{ symbol: string; amount: number; price: PriceCoin | 'usd' }>; error?: string }

export async function loadEthAccount(address: string): Promise<EthAccount> {
  if (fake()) return { address, eth: 1.5, tokens: [{ symbol: 'USDC', amount: 500, price: 'usd' }, { symbol: 'QNT', amount: 10, price: 'qnt' }] };
  return cached(`eth:${address.toLowerCase()}`, 120_000, async () => {
    try {
      const [wei, ...tok] = await Promise.all([
        ethRpc('eth_getBalance', [address, 'latest']),
        ...ETH_TOKENS.map((t) => ethRpc('eth_call', [{ to: t.contract, data: balanceOfData(address) }, 'latest']).catch(() => null)),
      ]);
      return {
        address, eth: fromUnits(wei, 18),
        tokens: ETH_TOKENS.map((t, i) => ({ symbol: t.symbol, price: t.price as PriceCoin | 'usd', amount: tok[i] ? fromUnits(tok[i]!, t.decimals) : NaN })).filter((t) => t.amount !== 0),
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

// ---------- Cardano ----------
const KOIOS = 'https://api.koios.rest/api/v1';

export interface AdaAccount { address: string; stake: string | null; ada: number; rewardsAda: number; whole: boolean; delegatedPool: string | null; error?: string }

async function koios<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${KOIOS}/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body), next: { revalidate: 300 }, signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

/** Ganzes Konto über die Stake-Adresse (alle Adressen + Belohnungen); sonst nur diese Adresse. */
export async function loadAdaAccount(address: string): Promise<AdaAccount> {
  const stake = stakeAddressOf(address);
  if (fake()) return { address, stake, ada: 1000, rewardsAda: 12.5, whole: !!stake, delegatedPool: null };
  return cached(`ada:${address}`, 120_000, async () => {
    try {
      if (stake) {
        const [acc] = await koios<Array<{ total_balance?: string; rewards_available?: string; delegated_pool?: string | null; status?: string }>>('account_info', { _stake_addresses: [stake] });
        if (acc) return { address, stake, ada: Number(acc.total_balance ?? 0) / LOVELACE_PER_ADA, rewardsAda: Number(acc.rewards_available ?? 0) / LOVELACE_PER_ADA, whole: true, delegatedPool: acc.delegated_pool ?? null };
      }
      const [a] = await koios<Array<{ balance?: string }>>('address_info', { _addresses: [address] });
      return { address, stake, ada: Number(a?.balance ?? 0) / LOVELACE_PER_ADA, rewardsAda: 0, whole: false, delegatedPool: null };
    } catch (e) {
      console.error('[ada]', (e as Error).message);
      return { address, stake, ada: NaN, rewardsAda: 0, whole: false, delegatedPool: null, error: 'Cardano-Netz gerade nicht erreichbar.' };
    }
  });
}

// ---------- Algorand ----------
const ALGO_NODES = ['https://mainnet-api.algonode.cloud', 'https://mainnet-api.4160.nodely.dev'];

export interface AlgoAccount { address: string; algo: number; minBalance: number; tokens: Array<{ symbol: string; amount: number }>; online: boolean; error?: string }

export async function loadAlgoAccount(address: string): Promise<AlgoAccount> {
  if (fake()) return { address, algo: 500, minBalance: 0.1, tokens: [{ symbol: 'USDC', amount: 100 }], online: false };
  return cached(`algo:${address}`, 120_000, async () => {
    for (const base of ALGO_NODES) {
      try {
        const r = await fetch(`${base}/v2/accounts/${address}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
        if (r.status === 404) return { address, algo: 0, minBalance: 0, tokens: [], online: false };
        if (!r.ok) { console.error('[algo]', base, `HTTP ${r.status}`); continue; }
        const j = (await r.json()) as { amount?: number; 'min-balance'?: number; status?: string; assets?: Array<{ 'asset-id': number; amount: number }> };
        const tokens = (j.assets ?? []).filter((a) => ALGO_STABLES[a['asset-id']] && a.amount > 0)
          .map((a) => ({ symbol: ALGO_STABLES[a['asset-id']].symbol, amount: a.amount / 10 ** ALGO_STABLES[a['asset-id']].decimals }));
        return { address, algo: (j.amount ?? 0) / MICRO_PER_ALGO, minBalance: (j['min-balance'] ?? 0) / MICRO_PER_ALGO, tokens, online: j.status === 'Online' };
      } catch (e) { console.error('[algo]', base, (e as Error).message); }
    }
    return { address, algo: NaN, minBalance: 0, tokens: [], online: false, error: 'Algorand-Netz gerade nicht erreichbar.' };
  });
}

// ---------- Zcash (nur transparente Adressen t1/t3) ----------
export interface ZecMove { txid: string; date: Date | null; zec: number; confirmed: boolean }
export interface ZecAccount { address: string; zec: number; pendingZec: number; txCount: number; moves: ZecMove[]; source?: string; error?: string }

const UA = { 'user-agent': 'Mozilla/5.0 (Jarvis read-only)', accept: 'application/json' };
// Blockbook-Instanzen (Trezor, Guarda) – gleiche API wie Ledger/Trezor-Wallets intern nutzen
const ZEC_BLOCKBOOK = ['https://zec1.trezor.io', 'https://zec2.trezor.io', 'https://zecbook.guarda.co'];

interface BlockbookAddr { balance?: string; unconfirmedBalance?: string; txs?: number; transactions?: Array<{ txid: string; blockTime?: number; confirmations?: number; vin?: Array<{ addresses?: string[]; value?: string }>; vout?: Array<{ addresses?: string[]; value?: string }> }> }

async function zecBlockchair(address: string): Promise<ZecAccount | null> {
  const r = await fetch(`https://api.blockchair.com/zcash/dashboards/address/${address}?transaction_details=true&limit=15`, { headers: UA, next: { revalidate: 300 }, signal: AbortSignal.timeout(7000) });
  if (!r.ok) { console.error('[zec] blockchair', `HTTP ${r.status}`); return null; }
  const j = (await r.json()) as { data?: Record<string, { address?: { balance?: number; transaction_count?: number }; transactions?: Array<{ hash: string; time?: string; balance_change?: number; block_id?: number }> }> };
  const d = j.data?.[address];
  if (!d?.address) return { address, zec: 0, pendingZec: 0, txCount: 0, moves: [], source: 'Blockchair' };
  const moves = (d.transactions ?? []).slice(0, 15).map((t) => ({
    txid: t.hash, date: t.time ? new Date(`${t.time.replace(' ', 'T')}Z`) : null, zec: (t.balance_change ?? 0) / ZAT_PER_ZEC, confirmed: (t.block_id ?? -1) > 0,
  }));
  return { address, zec: (d.address.balance ?? 0) / ZAT_PER_ZEC, pendingZec: 0, txCount: d.address.transaction_count ?? 0, moves, source: 'Blockchair' };
}

async function zecBlockbook(base: string, address: string): Promise<ZecAccount | null> {
  const r = await fetch(`${base}/api/v2/address/${address}?details=txs&pageSize=15`, { headers: UA, next: { revalidate: 120 }, signal: AbortSignal.timeout(7000) });
  if (!r.ok) { console.error('[zec]', base, `HTTP ${r.status}`); return null; }
  const a = (await r.json()) as BlockbookAddr;
  if (a.balance == null) return null;
  const sum = (xs: Array<{ addresses?: string[]; value?: string }> | undefined) => (xs ?? []).filter((x) => x.addresses?.includes(address)).reduce((n, x) => n + Number(x.value ?? 0), 0);
  const moves = (a.transactions ?? []).map((t) => ({
    txid: t.txid, date: t.blockTime ? new Date(t.blockTime * 1000) : null, zec: (sum(t.vout) - sum(t.vin)) / ZAT_PER_ZEC, confirmed: (t.confirmations ?? 0) > 0,
  }));
  return { address, zec: Number(a.balance) / ZAT_PER_ZEC, pendingZec: Number(a.unconfirmedBalance ?? 0) / ZAT_PER_ZEC, txCount: a.txs ?? 0, moves, source: new URL(base).hostname };
}

export async function loadZecAccount(address: string): Promise<ZecAccount> {
  if (fake()) return { address, zec: 12.5, pendingZec: 0, txCount: 2, moves: [{ txid: 'TESTZEC', date: new Date(Date.now() - 5 * 86_400_000), zec: 12.5, confirmed: true }], source: 'Test' };
  return cached(`zec:${address}`, 120_000, async () => {
    for (const base of ZEC_BLOCKBOOK) {
      try { const a = await zecBlockbook(base, address); if (a) return a; } catch (e) { console.error('[zec]', base, (e as Error).message); }
    }
    try { const a = await zecBlockchair(address); if (a) return a; } catch (e) { console.error('[zec] blockchair', (e as Error).message); }
    return { address, zec: NaN, pendingZec: 0, txCount: 0, moves: [], error: 'Zcash-Netz gerade nicht erreichbar.' };
  });
}
