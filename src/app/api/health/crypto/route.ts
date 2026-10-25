import { NextResponse } from 'next/server';
import { coinPrices, ethTokenSymbol, loadAdaAccount, loadAlgoAccount, loadBtcAccount, loadEthAccount, loadXrpAccount, loadZecAccount, loadAtomAccount, loadXlmAccount, loadLtcAccount, loadDotAccount, loadVetAccount, loadSolAccount } from '@/server/wallets';
import { ETH_TOKENS } from '@/lib/crypto/eth';
import { goldPrice } from '@/server/networth';

export const dynamic = 'force-dynamic';

/** Betriebscheck: XRP Ledger + Kurs erreichbar? Prüft nur ein bekanntes öffentliches Konto (Genesis), keine Nutzerdaten. */
export async function GET() {
  // Öffentliche Referenzkonten: XRP-Genesis, Ethereum-Stiftung (bekannt, öffentlich)
  const [acc, eth, btc, prices, gold, ada, algo, zec, atom, xlm, ltc, dot, vet, sol] = await Promise.all([loadXrpAccount('rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'), loadEthAccount('0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe'), loadBtcAccount('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'), coinPrices(['xrp', 'eth', 'btc', 'ada', 'algo', 'zec', 'atom', 'xlm', 'ltc', 'dot', 'vet', 'sol', 'qnt', 'fet', 'link', 'render', 'gala', 'hbar', 'cspr', 'fil', 'best']), goldPrice(),
    loadAdaAccount('addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgse35a3x'),
    loadAlgoAccount('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ'),
    // Zcash: Adresse der Zcash-Gründer-Belohnung (öffentlich, viele Bewegungen)
    loadZecAccount('t3Vz22vK5z2LcKEdg16Yv4FFneEL1zg9ojd'),
    // Cosmos: Community-Pool-/Distributionsmodul (öffentlich)
    loadAtomAccount('cosmos1jv65s3grqf6v6jl3dp4t6c9t9rk99cd88lyufl'),
    // Stellar: Circle-USDC-Herausgeber (öffentlich)
    loadXlmAccount('GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'),
    // Litecoin: öffentliche Referenzadresse (nur Erreichbarkeit der API)
    loadLtcAccount('M8T1B2Z97gVdvmfkQcAtYbEepune1tzGua'),
    // Polkadot: öffentliche Referenzadresse – prüft nur die Erreichbarkeit
    loadDotAccount('13UVJyLnbVp9RBZYFwFGyDvVd1y27Tt8tkntv6Q7JVPhFsTB'),
    // VeChain: Null-Adresse (nur Erreichbarkeit)
    loadVetAccount('0x0000000000000000000000000000000000000000'),
    // Solana: USDC-Mint (öffentlich, nur Erreichbarkeit)
    loadSolAccount('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')]);
  // Token-Verträge gegenprüfen: liefert der Vertrag das erwartete Symbol?
  const tokenCheck = Object.fromEntries(await Promise.all(ETH_TOKENS.map(async (t) => [t.symbol, (await ethTokenSymbol(t.contract)) === t.symbol] as const)));
  return NextResponse.json({
    ethTokens: tokenCheck,
    xrpl: acc.error ? { ok: false, fehler: acc.error } : { ok: true, aktiviert: acc.activated, bewegungen: acc.moves.length, reserve: acc.reserveXrp != null },
    eth: eth.error ? { ok: false, fehler: eth.error } : { ok: true, tokens: eth.tokens.filter((t) => Number.isFinite(t.amount)).length },
    btc: btc.error ? { ok: false, fehler: btc.error } : { ok: true, bewegungen: btc.moves.length },
    ada: ada.error ? { ok: false, fehler: ada.error } : { ok: true, ganzesKonto: ada.whole },
    algo: algo.error ? { ok: false, fehler: algo.error } : { ok: true },
    sol: sol.error ? { ok: false, fehler: sol.error } : { ok: true },
    vet: vet.error ? { ok: false, fehler: vet.error } : { ok: true },
    dot: dot.error ? { ok: false, fehler: dot.error } : { ok: true },
    ltc: ltc.error ? { ok: false, fehler: ltc.error } : { ok: true, quelle: ltc.source, bewegungen: ltc.moves.length },
    xlm: xlm.error ? { ok: false, fehler: xlm.error } : { ok: true, aktiviert: xlm.activated },
    atom: atom.error ? { ok: false, fehler: atom.error } : { ok: true },
    zec: zec.error ? { ok: false, fehler: zec.error } : { ok: true, quelle: zec.source, bewegungen: zec.moves.length },
    kurs: Object.fromEntries((['xrp', 'eth', 'btc', 'ada', 'algo', 'zec', 'atom', 'xlm', 'ltc', 'dot', 'vet', 'sol', 'qnt', 'fet', 'link', 'render', 'gala', 'hbar', 'cspr', 'fil', 'best'] as const).map((c) => [c, prices[c] ? { quelle: prices[c]!.source, h24: prices[c]!.change24h != null } : false])),
    gold: gold ? { ok: true, quelle: gold.source } : { ok: false },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
