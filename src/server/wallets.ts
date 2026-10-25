import 'server-only';
import { DROPS_PER_XRP, toMove, type XrpMove } from '@/lib/crypto/xrp';
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

/** Kurs XRP: CoinGecko, Ausweich Kraken. AED über die feste USD-Bindung. */
export async function xrpPrice(): Promise<Price | null> {
  if (fake()) return { eur: 2, usd: 2.2, aed: 2.2 * AED_PER_USD, source: 'Test', at: new Date() };
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=eur,usd', { next: { revalidate: 300 }, signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const j = (await r.json()) as { ripple?: { eur?: number; usd?: number } };
      if (j.ripple?.eur && j.ripple.usd) return { eur: j.ripple.eur, usd: j.ripple.usd, aed: j.ripple.usd * AED_PER_USD, source: 'CoinGecko', at: new Date() };
    }
  } catch { /* Ausweich */ }
  try {
    const r = await fetch('https://api.kraken.com/0/public/Ticker?pair=XRPEUR,XRPUSD', { next: { revalidate: 300 }, signal: AbortSignal.timeout(4000) });
    const j = (await r.json()) as { result?: Record<string, { c?: [string] }> };
    const pick = (re: RegExp) => Number(Object.entries(j.result ?? {}).find(([k]) => re.test(k))?.[1].c?.[0]);
    const eur = pick(/EUR$/), usd = pick(/USD$/);
    if (eur > 0 && usd > 0) return { eur, usd, aed: usd * AED_PER_USD, source: 'Kraken', at: new Date() };
  } catch { /* kein Kurs */ }
  return null;
}
