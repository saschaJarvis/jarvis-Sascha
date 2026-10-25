import 'server-only';
import { isDescriptor, descriptorOf, type AccountCoin, type Scheme } from '@/lib/crypto/xpub';

/**
 * Blockbook (Open-Source-Indexer von Trezor, auch von Wallets wie ZelCore betrieben):
 * Einzeladressen und ganze Konten (Descriptor mit xpub). Getestet von Vercel aus erreichbar (Stand 25.10.2026):
 * btc1/btc2.trezor.io, blockbook.*.zelcore.io, litecoinblockexplorer.net. Trezor-ZEC/LTC und Guarda sperren Server (403).
 */
export const BLOCKBOOK: Record<AccountCoin, string[]> = {
  btc: ['https://btc1.trezor.io', 'https://btc2.trezor.io', 'https://blockbook.btc.zelcore.io'],
  ltc: ['https://litecoinblockexplorer.net', 'https://blockbook.ltc.zelcore.io'],
  zec: ['https://blockbook.zec.zelcore.io'],
};
const UNIT = 100_000_000;

export interface BbMove { txid: string; date: Date | null; amount: number; confirmed: boolean }
export interface BbAccount { balance: number; pending: number; txCount: number; moves: BbMove[]; source: string; whole: boolean; usedAddresses?: number; withBalance?: number; addresses?: string[] }

interface BbTx { txid: string; blockTime?: number; confirmations?: number; vin?: Array<{ addresses?: string[]; value?: string; isOwn?: boolean }>; vout?: Array<{ addresses?: string[]; value?: string; isOwn?: boolean }> }
interface BbResp { balance?: string; unconfirmedBalance?: string; txs?: number; transactions?: BbTx[]; tokens?: Array<{ name: string; balance?: string }> }

async function fetchOne(host: string, target: string, whole: boolean, txs: boolean): Promise<BbResp> {
  const q = new URLSearchParams({ details: txs ? 'txs' : 'basic', pageSize: '15' });
  if (whole) q.set('tokens', 'used');
  const r = await fetch(`${host}/api/v2/${whole ? 'xpub' : 'address'}/${encodeURIComponent(target)}?${q}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (Jarvis read-only)', accept: 'application/json' }, next: { revalidate: 120 }, signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`${new URL(host).hostname} HTTP ${r.status}`);
  const j = (await r.json()) as BbResp;
  if (j.balance == null) throw new Error(`${new URL(host).hostname} ohne Saldo`);
  return j;
}

/** Konto (Descriptor) oder Einzeladresse laden; Server der Reihe nach, der erste gültige gewinnt. */
export async function blockbookLoad(coin: AccountCoin, target: string): Promise<BbAccount> {
  const whole = isDescriptor(target);
  const errors: string[] = [];
  for (const host of BLOCKBOOK[coin]) {
    try {
      const j = await fetchOne(host, target, whole, true);
      const own = new Set<string>(whole ? (j.tokens ?? []).map((t) => t.name) : [target]);
      const mine = (x: { addresses?: string[]; isOwn?: boolean }) => x.isOwn ?? (x.addresses ?? []).some((a) => own.has(a));
      const moves = (j.transactions ?? []).map((t) => ({
        txid: t.txid, date: t.blockTime ? new Date(t.blockTime * 1000) : null, confirmed: (t.confirmations ?? 0) > 0,
        amount: ((t.vout ?? []).filter(mine).reduce((n, o) => n + Number(o.value ?? 0), 0) - (t.vin ?? []).filter(mine).reduce((n, i) => n + Number(i.value ?? 0), 0)) / UNIT,
      }));
      return {
        balance: Number(j.balance) / UNIT, pending: Number(j.unconfirmedBalance ?? 0) / UNIT, txCount: j.txs ?? 0, moves, source: new URL(host).hostname, whole,
        ...(whole ? { usedAddresses: (j.tokens ?? []).length, withBalance: (j.tokens ?? []).filter((t) => Number(t.balance ?? 0) > 0).length, addresses: [...own] } : {}),
      };
    } catch (e) { errors.push((e as Error).message); }
  }
  throw new Error(errors.join('; ') || 'kein Server');
}

/** Nacktes „xpub“ ohne Kontoart: alle Arten abfragen, die mit den meisten Transaktionen nehmen. */
export async function detectScheme(coin: AccountCoin, key: string): Promise<{ descriptor: string; txs: number; addresses: string[] }> {
  const schemes: Scheme[] = coin === 'zec' ? ['pkh'] : ['wpkh', 'sh(wpkh)', 'pkh', 'tr'];
  const res = await Promise.all(schemes.map(async (sc) => {
    const d = descriptorOf(key, sc);
    try { const a = await blockbookLoad(coin, d); return { descriptor: d, txs: a.txCount, addresses: a.addresses ?? [] }; } catch { return { descriptor: d, txs: -1, addresses: [] }; }
  }));
  const best = res.sort((a, b) => b.txs - a.txs)[0];
  if (best.txs < 0) throw new Error('Konto gerade nicht abrufbar');
  return best;
}
