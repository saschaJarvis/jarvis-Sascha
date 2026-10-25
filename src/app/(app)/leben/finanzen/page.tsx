import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { coinPrices, loadAdaAccount, loadAlgoAccount, loadBtcAccount, loadEthAccount, loadXrpAccount, loadZecAccount, loadAtomAccount, loadXlmAccount, loadLtcAccount, loadDotAccount, loadVetAccount, loadSolAccount, WALLETS_SQL, MANUAL_SQL, MANUAL_SYMBOLS, type ManualRow, type AdaAccount, type AlgoAccount, type BtcAccount, type Coin, type EthAccount, type PriceCoin, type XrpAccount, type ZecAccount, type AtomAccount, type XlmAccount, type LtcAccount, type DotAccount, type VetAccount, type SolAccount } from '@/server/wallets';
import { AED_PER_USD } from '@/lib/domain/networth';
import { PageTitle, Section } from '@/components/ui';
import { timeAgo } from '@/lib/news';
import { AddAccountForm, AddGoldForm, AddManualForm, AddWalletForm, BalanceForm, ManualAmountForm } from './wallet-form';
import { ConnectSection } from '../../kalender/connect-form';
import { removeAccountAction, removeGoldAction, removeManualAction, removeWalletAction } from './actions';
import { loadNetWorth } from '@/server/networth';
import { CryptoChange, NetWorthCard } from '@/components/net-worth';
import { AutoRefresh } from '@/components/auto-refresh';
import { isDescriptor, keyOfDescriptor } from '@/lib/crypto/xpub';
import { StatementsSection } from '@/components/statements';
import { kickStatements, loadStatements } from '@/server/statements';
import { claudeAvailable } from '@/server/claude';

const KIND: Record<string, string> = { checking: 'Girokonto', savings: 'Sparkonto', deposit: 'Festgeld', credit_card: 'Kreditkarte', crypto_exchange: 'Krypto-Börse', other: 'Sonstiges', loan: 'Kredit' };
const FORM: Record<string, string> = { bar: 'Barren', coin: 'Münze', jewelry: 'Schmuck', other: 'Sonstiges' };

export const dynamic = 'force-dynamic';

const nf = (n: number, d = 2) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const DEC: Record<Coin, number> = { xrp: 2, eth: 4, btc: 8, ada: 2, algo: 2, zec: 4, atom: 4, xlm: 2, ltc: 4, dot: 2, vet: 0, sol: 4 };
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default async function FinancePage() {
  const s = await requireUser();
  // Offene Kontoauszüge im Hintergrund auswerten (Ergebnis erscheint beim nächsten Auto-Refresh)
  await kickStatements(s).catch((e) => console.error('[statement] kick', e));
  const [wallets, manual] = await db(s).run(async (q) => [
    await q<{ id: string; chain: Coin; address: string; label: string }>(WALLETS_SQL),
    await q<ManualRow>(MANUAL_SQL),
  ] as const);
  const [views, prices, nw] = await Promise.all([
    Promise.all(wallets.map((w): Promise<XrpAccount | EthAccount | BtcAccount | AdaAccount | AlgoAccount | ZecAccount | AtomAccount | XlmAccount | LtcAccount | DotAccount | VetAccount | SolAccount> => (w.chain === 'sol' ? loadSolAccount(w.address) : w.chain === 'vet' ? loadVetAccount(w.address) : w.chain === 'dot' ? loadDotAccount(w.address) : w.chain === 'ltc' ? loadLtcAccount(w.address) : w.chain === 'xlm' ? loadXlmAccount(w.address) : w.chain === 'atom' ? loadAtomAccount(w.address) : w.chain === 'zec' ? loadZecAccount(w.address) : w.chain === 'eth' ? loadEthAccount(w.address) : w.chain === 'btc' ? loadBtcAccount(w.address) : w.chain === 'ada' ? loadAdaAccount(w.address) : w.chain === 'algo' ? loadAlgoAccount(w.address) : loadXrpAccount(w.address)))),
    coinPrices([...new Set<PriceCoin>([...wallets.map((w) => w.chain), ...(wallets.some((w) => w.chain === 'eth') ? ['qnt' as const, 'fet' as const, 'link' as const, 'gala' as const] : []), ...(wallets.some((w) => w.chain === 'sol') ? ['render' as const] : []), ...manual.map((m) => MANUAL_SYMBOLS[m.symbol]).filter(Boolean)])]),
    loadNetWorth(s),
  ]);
  const statements = await loadStatements(s);
  const EXPLORER: Record<Coin, (a: string) => string> = { xrp: (a) => `https://livenet.xrpl.org/accounts/${a}`, eth: (a) => `https://etherscan.io/address/${a}`, btc: (a) => (isDescriptor(a) ? `https://btc1.trezor.io/xpub/${encodeURIComponent(a)}` : `https://mempool.space/address/${a}`), ada: (a) => `https://cardanoscan.io/address/${a}`, algo: (a) => `https://allo.info/account/${a}`, zec: (a) => (isDescriptor(a) ? `https://blockbook.zec.zelcore.io/xpub/${encodeURIComponent(a)}` : `https://blockchair.com/zcash/address/${a}`), atom: (a) => `https://www.mintscan.io/cosmos/address/${a}`, xlm: (a) => `https://stellar.expert/explorer/public/account/${a}`, dot: (a) => `https://assethub-polkadot.subscan.io/account/${a}`, vet: (a) => `https://vechainstats.com/account/${a}`, sol: (a) => `https://solscan.io/account/${a}`, ltc: (a) => (isDescriptor(a) ? `https://litecoinblockexplorer.net/xpub/${encodeURIComponent(a)}` : `https://litecoinspace.org/address/${a}`) };
  const now = new Date();

  return (
    <div>
      <PageTitle back={{ href: '/leben', label: 'Leben' }} title="Finanzen" />
      <AutoRefresh seconds={30} />

      <NetWorthCard nw={nw} />

      <Section title="Konten" aside={<span className="mono text-xs text-muted">{nw.accounts.count} Konten</span>}>
        <ul className="grid gap-3">
          {nw.accounts.rows.map((a) => (
            <li key={a.id} className="card grid gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{a.name}</p>
                  <p className="text-xs text-muted">{[a.institution, KIND[a.kind] ?? a.kind].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${a.amount_minor && Number(a.amount_minor) < 0 ? 'text-bad' : ''}`}>{a.amount_minor == null ? '–' : `${nf(Number(a.amount_minor) / 100)} ${a.currency}`}</p>
                  {a.as_of && <p className="text-xs text-muted">Stand {new Date(`${a.as_of}T12:00:00Z`).toLocaleDateString('de-DE')}</p>}
                </div>
              </div>
              <details>
                <summary className="cursor-pointer text-sm text-sea">Kontostand aktualisieren</summary>
                <div className="mt-2"><BalanceForm id={a.id} label={a.name} /></div>
                <form action={removeAccountAction} className="mt-2"><input type="hidden" name="id" value={a.id} /><button className="text-xs text-muted underline">Konto entfernen</button></form>
              </details>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <ConnectSection initialOpen={nw.accounts.count === 0} title="+ Konto hinzufügen">
            <div className="mt-3"><AddAccountForm /></div>
          </ConnectSection>
        </div>
      </Section>

      <Section title="Gold" aside={nw.gold.price ? <span className="mono text-xs text-muted">1 oz = {nf(nw.gold.price.usdPerOz, 0)} USD</span> : null}>
        <ul className="grid gap-3">
          {nw.gold.rows.map((g) => (
            <li key={g.id} className="card flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{g.label}</p>
                <p className="text-xs text-muted">{nf(Number(g.grams), Number(g.grams) % 1 ? 2 : 0)} g · {g.purity === 999 ? '999,9' : g.purity} · {FORM[g.form] ?? g.form}</p>
                <form action={removeGoldAction} className="mt-1"><input type="hidden" name="id" value={g.id} /><button className="text-xs text-muted underline">Entfernen</button></form>
              </div>
              <div className="text-right">
                {g.aed == null ? <p className="text-sm text-muted">Preis fehlt</p> : <>
                  <p className="text-lg font-bold">{nf(g.aed, 0)} AED</p>
                  {nw.eurAed && <p className="text-sm text-muted">≈ {nf(g.aed / nw.eurAed, 0)} €</p>}
                </>}
              </div>
            </li>
          ))}
        </ul>
        {nw.gold.price && nw.gold.count > 0 && <p className="mt-2 text-xs text-muted">Bewertung zum Spotpreis ({nw.gold.price.source}) × Feingehalt. Ankaufspreise beim Händler liegen meist etwas darunter, Schmuck oft deutlich.</p>}
        <div className="mt-3">
          <ConnectSection initialOpen={nw.gold.count === 0} title="+ Gold hinzufügen">
            <div className="mt-3"><AddGoldForm /></div>
          </ConnectSection>
        </div>
      </Section>

      <Section title="Krypto · nur ansehen" aside={<span className="mono text-xs text-muted">{(Object.entries(prices) as Array<[PriceCoin, { eur: number }]>).map(([c, p]) => `1 ${c.toUpperCase()} = ${nf(p.eur, p.eur < 10 ? 4 : 0)} €`).join(' · ')}</span>}>
        <p className="notice notice-info mb-3 text-sm">
          🔒 Jarvis kennt nur deine <strong>öffentliche Adresse</strong> und kann damit nichts versenden. Deine 24 Wörter, PIN oder dein Ledger werden nie gebraucht – wer danach fragt, will dich betrügen.
        </p>

        {wallets.length > 0 && (
          <div className="card mb-3 grid gap-1">
            <p className="eyebrow">Krypto gesamt</p>
            <p className="text-2xl font-bold">{nf(nw.crypto.aed, 0)} AED</p>
            <p className="text-muted">{nw.eurAed ? `≈ ${nf(nw.crypto.aed / nw.eurAed, 0)} € · ` : ''}{Object.entries(nw.crypto.holdings).filter(([, v]) => v != null).sort(([a], [b]) => ['BTC', 'ETH', 'LTC', 'XRP', 'ADA', 'ALGO', 'ZEC', 'ATOM', 'XLM', 'DOT', 'VET', 'SOL', 'QNT', 'FET', 'LINK', 'RENDER', 'GALA', 'HBAR', 'CSPR', 'USDT', 'USDC'].indexOf(a) - ['BTC', 'ETH', 'LTC', 'XRP', 'ADA', 'ALGO', 'ZEC', 'ATOM', 'XLM', 'DOT', 'VET', 'SOL', 'QNT', 'FET', 'LINK', 'RENDER', 'GALA', 'HBAR', 'CSPR', 'USDT', 'USDC'].indexOf(b)).map(([k, v]) => `${nf(v ?? 0, k === 'BTC' ? 8 : k === 'ETH' ? 4 : 2)} ${k}`).join(' · ')}</p>
            {nw.crypto.error && <p className="text-sm text-warn">Ein Teil ist gerade ohne Kurs oder Netz – nicht mitgezählt.</p>}
            {nw.crypto.change && <div className="mt-1"><CryptoChange ch={nw.crypto.change} asOf={nw.crypto.asOf} label="24 h" /></div>}
            {nw.crypto.coins.length > 0 && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[19rem] text-sm">
                  <thead><tr className="mono text-left text-[.6rem] uppercase tracking-[.14em] text-muted">
                    <th className="py-1 font-normal">Coin</th><th className="py-1 text-right font-normal">Kurs</th><th className="py-1 text-right font-normal">24 h</th><th className="py-1 text-right font-normal">Wert</th>
                  </tr></thead>
                  <tbody>
                    {[...nw.crypto.coins].sort((a, b) => b.aed - a.aed).map((c) => {
                      const tone = c.changePct == null ? 'text-muted' : c.changePct > 0 ? 'text-good' : c.changePct < 0 ? 'text-bad' : 'text-muted';
                      return (
                        <tr key={c.coin} className="border-t border-line">
                          <td className="py-1.5 font-semibold">{c.coin.toUpperCase()}</td>
                          <td className="hud-num py-1.5 text-right">{nf(c.priceEur, c.priceEur < 10 ? 4 : 2)} €<span className="block text-xs text-muted">{nf(c.priceAed, c.priceAed < 10 ? 4 : 2)} AED</span></td>
                          <td className={`hud-num py-1.5 text-right ${tone}`}>
                            {c.changePct == null ? '–' : `${c.changePct > 0 ? '+' : c.changePct < 0 ? '−' : '±'}${nf(Math.abs(c.changePct) * 100, 2)} %`}
                            {c.changeAed != null && nw.eurAed && <span className="block text-xs">{c.changeAed >= 0 ? '+' : '−'}{nf(Math.abs(c.changeAed / nw.eurAed), 0)} € · {c.changeAed >= 0 ? '+' : '−'}{nf(Math.abs(c.changeAed), 0)} AED</span>}
                          </td>
                          <td className="hud-num py-1.5 text-right">{nf(c.eur, 0)} €<span className="block text-xs text-muted">{nf(c.aed, 0)} AED</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-1 text-xs text-muted">Kurse: {[...new Set(nw.crypto.coins.map((c) => c.source))].join(', ')} · letzter Handelspreis, 24 h = Vergleich mit dem Kurs vor 24 Stunden. Aktualisiert sich alle 30 Sekunden.</p>
              </div>
            )}
          </div>
        )}

        <ul className="grid gap-3">
          {wallets.map((w, i) => {
            const v = views[i];
            const p = prices[w.chain];
            const sym = w.chain.toUpperCase();
            const x = w.chain === 'xrp' ? (v as XrpAccount) : null;
            const e = w.chain === 'eth' ? (v as EthAccount) : null;
            const b = w.chain === 'btc' ? (v as BtcAccount) : null;
            const c = w.chain === 'ada' ? (v as AdaAccount) : null;
            const g = w.chain === 'algo' ? (v as AlgoAccount) : null;
            const z = w.chain === 'zec' ? (v as ZecAccount) : null;
            const at = w.chain === 'atom' ? (v as AtomAccount) : null;
            const st = w.chain === 'xlm' ? (v as XlmAccount) : null;
            const lt = w.chain === 'ltc' ? (v as LtcAccount) : null;
            const dt = w.chain === 'dot' ? (v as DotAccount) : null;
            const vt = w.chain === 'vet' ? (v as VetAccount) : null;
            const so = w.chain === 'sol' ? (v as SolAccount) : null;
            const amount = x ? x.xrp : e ? e.eth : b ? b.btc : c ? c.ada : z ? z.zec : at ? at.atom : st ? st.xlm : lt ? lt.ltc : dt ? dt.dot : vt ? vt.vet : so ? so.sol : g!.algo;
            // Token-Wert in €: Stablecoins = 1 USD, andere (z. B. QNT) zum eigenen Kurs
            const tokenEur = e && nw.eurAed ? e.tokens.reduce((n, t) => n + (!Number.isFinite(t.amount) ? 0 : t.price === 'usd' ? (t.amount * AED_PER_USD) / nw.eurAed! : t.amount * (prices[t.price]?.eur ?? 0)), 0) : 0;
            return (
              <li key={w.id} className="card grid gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{w.label} <span className="mono text-xs text-muted">{sym}</span></p>
                    <a className="mono break-all text-xs text-sea underline" href={EXPLORER[w.chain](w.address)} target="_blank" rel="noopener noreferrer">{isDescriptor(w.address) ? `Kontoschlüssel ${short(keyOfDescriptor(w.address))}` : short(w.address)} ↗</a>
                  </div>
                  <div className="text-right">
                    {v.error ? <p className="text-sm text-warn">{v.error}</p>
                      : x && !x.activated ? <p className="text-sm text-muted">Noch nicht aktiviert (0 XRP)</p>
                      : <>
                        <p className="text-lg font-bold">{nf(amount, DEC[w.chain])} {sym}</p>
                        {p && <p className="text-sm text-muted">≈ {nf(amount * p.eur + tokenEur)} €</p>}
                      </>}
                  </div>
                </div>
                {e && e.tokens.length > 0 && !e.error && (
                  <p className="text-sm">{e.tokens.map((t) => Number.isFinite(t.amount) ? `+ ${nf(t.amount, t.price === 'usd' ? 2 : 4)} ${t.symbol}` : `${t.symbol}: nicht abrufbar`).join(' · ')}</p>
                )}
                {e && !e.error && <p className="text-xs text-muted">Gezählt: ETH, Quant (QNT), Fetch.ai (FET), Chainlink (LINK), Gala (GALA), USDT und USDC. Andere Tokens/NFTs siehst du über den Etherscan-Link.</p>}
                {g && !g.error && (
                  <p className="text-xs text-muted">
                    {g.tokens.length ? `${g.tokens.map((t) => `+ ${nf(t.amount, 2)} ${t.symbol}`).join(' · ')} · ` : ''}Davon {nf(g.minBalance, 2)} ALGO als Mindestguthaben gebunden.{g.online ? ' Nimmt am Konsens teil (Staking).' : ''}
                  </p>
                )}
                {c && !c.error && (
                  <p className="text-xs text-muted">
                    {c.whole ? `Ganzes Cardano-Konto (alle Adressen) inkl. ${nf(c.rewardsAda, 2)} ADA Staking-Belohnungen.` : 'Nur diese Adresse (ohne Staking-Teil).'}
                    {c.delegatedPool ? ' Gestaked.' : c.whole ? ' Nicht gestaked.' : ''}
                  </p>
                )}
                {b && !b.error && (
                  <>
                    {b.pendingBtc !== 0 && <p className="text-xs text-warn">Unbestätigt: {b.pendingBtc > 0 ? '+' : ''}{nf(b.pendingBtc, 8)} BTC</p>}
                    {b.whole && <p className="text-xs text-muted">Ganzes Bitcoin-Konto: alle Empfangs- und Wechselgeld-Adressen ({b.usedAddresses ?? 0} benutzt, {b.withBalance ?? 0} mit Guthaben) – sollte genau mit Ledger Live übereinstimmen.</p>}
                    {!b.whole && b.btc === 0 && (
                      <p className="notice notice-warn text-sm">
                        {b.txCount > 0
                          ? `Auf dieser Adresse liegt gerade 0 BTC – sie wurde schon ${b.txCount}× benutzt und ist inzwischen leer. Ledger Live nimmt für jeden Empfang eine neue Adresse; dein Bitcoin liegt also vermutlich auf neueren Adressen.`
                          : 'Diese Adresse wurde noch nie benutzt (0 BTC). Ledger Live verteilt Bitcoin auf mehrere Adressen.'}
                      </p>
                    )}
                    {!b.whole && <p className="text-xs text-muted">Zeigt nur diese eine Adresse. Ledger Live verteilt Bitcoin auf viele Adressen – für den genauen Betrag den Kontoschlüssel einfügen (Ledger Live: Konto bearbeiten → Erweitert).</p>}
                    {b.moves.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-sm text-sea">Letzte Bewegungen ({b.moves.length})</summary>
                        <ul className="mt-2 grid gap-1 text-sm">
                          {b.moves.map((m) => (
                            <li key={m.txid} className="flex items-baseline justify-between gap-2 border-b border-line pb-1 last:border-0">
                              <span className={m.btc > 0 ? 'text-good' : m.btc < 0 ? 'text-bad' : 'text-muted'}>{m.btc > 0 ? '↓ Eingang' : m.btc < 0 ? '↑ Ausgang' : '↔'}{!m.confirmed && ' (unbestätigt)'}</span>
                              <span className="shrink-0 text-right">{m.btc > 0 ? '+' : m.btc < 0 ? '−' : ''}{nf(Math.abs(m.btc), 8)} BTC
                                <span className="block text-xs text-muted" suppressHydrationWarning>{m.date ? timeAgo(m.date, now) : 'ausstehend'}</span></span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
                {so && !so.error && (
                  <p className="text-sm">
                    {so.tokens.map((t) => `+ ${nf(t.amount, 2)} ${t.symbol}`).join(' · ')}
                    {so.tokens.length > 0 && nw.eurAed ? ` ≈ ${nf(so.tokens.reduce((n, t) => n + (t.price === 'usd' ? (t.amount * AED_PER_USD) / nw.eurAed! : t.amount * (prices[t.price]?.eur ?? 0)), 0))} €` : ''}
                    <span className="block text-xs text-muted">Solana-Netz: gezählt SOL{so.staked ? ` (davon ${nf(so.staked, 4)} gestaked)` : ''}, Render (RENDER), USDC und USDT.</span>
                  </p>
                )}
                {vt && !vt.error && <p className="text-xs text-muted">VeChain-Netz.{vt.vtho > 0 ? ` Dazu ${nf(vt.vtho, 2)} VTHO (Gebühren-Token, entsteht automatisch, nicht mitgezählt).` : ''}</p>}
                {dt && !dt.error && (
                  <p className="text-xs text-muted">
                    Polkadot Asset Hub + Relay-Chain zusammen.{dt.frozen > 0 ? ` Davon ${nf(dt.frozen, 2)} DOT gebunden (Staking/Sperre).` : ' Nicht gestaked.'}{dt.reserved > 0 ? ` ${nf(dt.reserved, 2)} DOT reserviert.` : ''}
                  </p>
                )}
                {lt && !lt.error && (
                  <>
                    {lt.pendingLtc !== 0 && <p className="text-xs text-warn">Unbestätigt: {lt.pendingLtc > 0 ? '+' : ''}{nf(lt.pendingLtc, 8)} LTC</p>}
                    <p className="text-xs text-muted">{lt.whole ? `Ganzes Litecoin-Konto: alle Empfangs- und Wechselgeld-Adressen (${lt.usedAddresses ?? 0} benutzt, ${lt.withBalance ?? 0} mit Guthaben) – sollte genau mit Ledger Live übereinstimmen.` : <>Zeigt nur diese eine Adresse.{lt.ltc === 0 && lt.txCount > 0 ? ` Sie wurde ${lt.txCount}× benutzt und ist gerade leer – Ledger Live nimmt für jeden Empfang eine neue Adresse.` : ' Weicht der Betrag von Ledger Live ab, füge den Kontoschlüssel (Ltub…) hinzu – dann sieht Jarvis das ganze Konto.'}</>}</p>
                    {lt.moves.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-sm text-sea">Letzte Bewegungen ({lt.moves.length})</summary>
                        <ul className="mt-2 grid gap-1 text-sm">
                          {lt.moves.map((m) => (
                            <li key={m.txid} className="flex items-baseline justify-between gap-2 border-b border-line pb-1 last:border-0">
                              <span className={m.ltc > 0 ? 'text-good' : m.ltc < 0 ? 'text-bad' : 'text-muted'}>{m.ltc > 0 ? '↓ Eingang' : m.ltc < 0 ? '↑ Ausgang' : '↔'}{!m.confirmed && ' (unbestätigt)'}</span>
                              <span className="shrink-0 text-right">{m.ltc > 0 ? '+' : m.ltc < 0 ? '−' : ''}{nf(Math.abs(m.ltc), 4)} LTC
                                <span className="block text-xs text-muted" suppressHydrationWarning>{m.date ? timeAgo(m.date, now) : 'ausstehend'}</span></span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
                {st && !st.error && (
                  <p className="text-xs text-muted">
                    {!st.activated ? 'Konto noch nicht aktiviert (0 XLM).' : `${st.tokens.length ? `${st.tokens.map((t) => `+ ${nf(t.amount, 2)} ${t.symbol}`).join(' · ')} · ` : ''}Davon ${nf(st.reserveXlm, 1)} XLM als Mindestreserve des Stellar-Netzes gebunden.`}
                  </p>
                )}
                {at && !at.error && (
                  <p className="text-xs text-muted">
                    Frei {nf(at.liquid, 4)} · gestaked {nf(at.staked, 4)}{at.validators ? ` (bei ${at.validators} Validator${at.validators === 1 ? '' : 'en'})` : ''}{at.unbonding ? ` · in Entsperrung ${nf(at.unbonding, 4)}` : ''} · Belohnungen {nf(at.rewards, 4)} ATOM. Alles zusammen zählt ins Vermögen.
                  </p>
                )}
                {z && !z.error && (
                  <>
                    {z.pendingZec !== 0 && <p className="text-xs text-warn">Unbestätigt: {z.pendingZec > 0 ? '+' : ''}{nf(z.pendingZec, 8)} ZEC</p>}
                    <p className="text-xs text-muted">{z.whole ? `Ganzes Zcash-Konto: alle transparenten Adressen (${z.usedAddresses ?? 0} benutzt, ${z.withBalance ?? 0} mit Guthaben).` : 'Zeigt nur das transparente Guthaben dieser t1-Adresse.'}{z.source ? ` Quelle: ${z.source}.` : ''} Abgeschirmte (shielded) ZEC sind von außen nicht sichtbar.{!z.whole && z.zec === 0 && z.txCount > 0 ? ` Die Adresse wurde ${z.txCount}× benutzt und ist gerade leer – für den genauen Betrag den Kontoschlüssel aus Ledger Live einfügen (Konto bearbeiten → Erweitert).` : ''}</p>
                    {z.moves.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-sm text-sea">Letzte Bewegungen ({z.moves.length})</summary>
                        <ul className="mt-2 grid gap-1 text-sm">
                          {z.moves.map((m) => (
                            <li key={m.txid} className="flex items-baseline justify-between gap-2 border-b border-line pb-1 last:border-0">
                              <span className={m.zec > 0 ? 'text-good' : m.zec < 0 ? 'text-bad' : 'text-muted'}>{m.zec > 0 ? '↓ Eingang' : m.zec < 0 ? '↑ Ausgang' : '↔'}{!m.confirmed && ' (unbestätigt)'}</span>
                              <span className="shrink-0 text-right">{m.zec > 0 ? '+' : m.zec < 0 ? '−' : ''}{nf(Math.abs(m.zec), 4)} ZEC
                                <span className="block text-xs text-muted" suppressHydrationWarning>{m.date ? timeAgo(m.date, now) : 'ausstehend'}</span></span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
                {x && x.reserveXrp != null && x.activated && !x.error && (
                  <p className="text-xs text-muted">Davon {nf(x.reserveXrp, 1)} XRP als Mindestreserve des XRP Ledgers gebunden.</p>
                )}
                {x && x.moves.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm text-sea">Letzte Bewegungen ({x.moves.length})</summary>
                    <ul className="mt-2 grid gap-1 text-sm">
                      {x.moves.map((m) => (
                        <li key={m.hash} className="flex items-baseline justify-between gap-2 border-b border-line pb-1 last:border-0">
                          <span className="min-w-0">
                            <span className={m.direction === 'in' ? 'text-good' : m.direction === 'out' ? 'text-bad' : 'text-muted'}>
                              {m.direction === 'in' ? '↓ Eingang' : m.direction === 'out' ? '↑ Ausgang' : m.type === 'Payment' ? '↔ Zahlung' : m.type}
                            </span>
                            {m.counterparty && <span className="mono text-xs text-muted"> · {short(m.counterparty)}</span>}
                          </span>
                          <span className="shrink-0 text-right">
                            {m.xrp != null && m.direction !== 'other' ? `${m.direction === 'out' ? '−' : '+'}${nf(m.xrp, 2)} XRP` : ''}
                            <span className="block text-xs text-muted" suppressHydrationWarning>{timeAgo(m.date, now)}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <form action={removeWalletAction}>
                  <input type="hidden" name="id" value={w.id} />
                  <button className="text-xs text-muted underline">Entfernen</button>
                </form>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 grid gap-2">
          <p className="eyebrow">Auf Börsen · von Hand</p>
          {manual.map((m) => {
            const p = prices[MANUAL_SYMBOLS[m.symbol]];
            const amt = Number(m.amount);
            return (
              <div key={m.id} className="card grid gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{m.label} <span className="mono text-xs text-muted">{m.symbol}</span></p>
                    <p className="text-xs text-muted">{m.venue ? `${m.venue} · ` : ''}Menge von Hand – nur Kurswarnung, keine Abfluss-Warnung.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{nf(amt, amt % 1 ? 2 : 0)} {m.symbol}</p>
                    {p && <p className="text-sm text-muted">≈ {nf(amt * p.eur)} €</p>}
                  </div>
                </div>
                <details>
                  <summary className="cursor-pointer text-sm text-sea">Menge ändern</summary>
                  <div className="mt-2"><ManualAmountForm id={m.id} label={m.label} /></div>
                  <form action={removeManualAction} className="mt-2"><input type="hidden" name="id" value={m.id} /><button className="text-xs text-muted underline">Entfernen</button></form>
                </details>
              </div>
            );
          })}
          <ConnectSection initialOpen={false} title="+ Bestand auf einer Börse eintragen (z. B. Bitpanda)">
            <div className="mt-3"><AddManualForm symbols={Object.keys(MANUAL_SYMBOLS)} /></div>
          </ConnectSection>
        </div>

        <div className="mt-3">
          <ConnectSection initialOpen={wallets.length === 0} title="+ Wallet-Adresse hinzufügen (BTC / ETH / XRP / ADA / ALGO / ZEC / ATOM / XLM / LTC / DOT / VET / SOL)">
            <div className="mt-3"><AddWalletForm /></div>
          </ConnectSection>
        </div>
      </Section>

      <div id="kontoauszuege" className="scroll-mt-20">
        <Section title="Kontoauszüge" aside={<span className="mono text-xs text-muted">{statements.filter((r) => r.status === 'done').length} ausgewertet</span>}>
          <StatementsSection rows={statements} claude={claudeAvailable()} />
        </Section>
      </div>
    </div>
  );
}
