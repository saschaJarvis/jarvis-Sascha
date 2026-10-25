import { NextResponse } from 'next/server';
import { coinPrices, loadAdaAccount, loadAlgoAccount, loadBtcAccount, loadEthAccount, loadXrpAccount } from '@/server/wallets';
import { goldPrice } from '@/server/networth';

export const dynamic = 'force-dynamic';

/** Betriebscheck: XRP Ledger + Kurs erreichbar? Prüft nur ein bekanntes öffentliches Konto (Genesis), keine Nutzerdaten. */
export async function GET() {
  // Öffentliche Referenzkonten: XRP-Genesis, Ethereum-Stiftung (bekannt, öffentlich)
  const [acc, eth, btc, prices, gold, ada, algo] = await Promise.all([loadXrpAccount('rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'), loadEthAccount('0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe'), loadBtcAccount('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'), coinPrices(['xrp', 'eth', 'btc', 'ada', 'algo']), goldPrice(),
    loadAdaAccount('addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x'),
    loadAlgoAccount('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ')]);
  return NextResponse.json({
    xrpl: acc.error ? { ok: false, fehler: acc.error } : { ok: true, aktiviert: acc.activated, bewegungen: acc.moves.length, reserve: acc.reserveXrp != null },
    eth: eth.error ? { ok: false, fehler: eth.error } : { ok: true, tokens: eth.tokens.filter((t) => Number.isFinite(t.amount)).length },
    btc: btc.error ? { ok: false, fehler: btc.error } : { ok: true, bewegungen: btc.moves.length },
    ada: ada.error ? { ok: false, fehler: ada.error } : { ok: true, ganzesKonto: ada.whole },
    algo: algo.error ? { ok: false, fehler: algo.error } : { ok: true },
    kurs: Object.fromEntries((['xrp', 'eth', 'btc', 'ada', 'algo'] as const).map((c) => [c, prices[c] ? { quelle: prices[c]!.source, h24: prices[c]!.change24h != null } : false])),
    gold: gold ? { ok: true, quelle: gold.source } : { ok: false },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
