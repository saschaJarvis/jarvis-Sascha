import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { coinPrices, loadAdaAccount, loadBtcAccount, loadEthAccount, loadXrpAccount, WALLETS_SQL, type AdaAccount, type BtcAccount, type Coin, type EthAccount, type XrpAccount } from '@/server/wallets';
import { AED_PER_USD } from '@/lib/domain/networth';
import { PageTitle, Section } from '@/components/ui';
import { timeAgo } from '@/lib/news';
import { AddAccountForm, AddGoldForm, AddWalletForm, BalanceForm } from './wallet-form';
import { ConnectSection } from '../../kalender/connect-form';
import { removeAccountAction, removeGoldAction, removeWalletAction } from './actions';
import { loadNetWorth } from '@/server/networth';
import { NetWorthCard } from '@/components/net-worth';

const KIND: Record<string, string> = { checking: 'Girokonto', savings: 'Sparkonto', deposit: 'Festgeld', credit_card: 'Kreditkarte', crypto_exchange: 'Krypto-Börse', other: 'Sonstiges', loan: 'Kredit' };
const FORM: Record<string, string> = { bar: 'Barren', coin: 'Münze', jewelry: 'Schmuck', other: 'Sonstiges' };

export const dynamic = 'force-dynamic';

const nf = (n: number, d = 2) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const DEC: Record<Coin, number> = { xrp: 2, eth: 4, btc: 8, ada: 2 };
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default async function FinancePage() {
  const s = await requireUser();
  const wallets = await db(s).run((q) => q<{ id: string; chain: Coin; address: string; label: string }>(
    WALLETS_SQL));
  const [views, prices, nw] = await Promise.all([
    Promise.all(wallets.map((w): Promise<XrpAccount | EthAccount | BtcAccount | AdaAccount> => (w.chain === 'eth' ? loadEthAccount(w.address) : w.chain === 'btc' ? loadBtcAccount(w.address) : w.chain === 'ada' ? loadAdaAccount(w.address) : loadXrpAccount(w.address)))),
    coinPrices([...new Set(wallets.map((w) => w.chain))]),
    loadNetWorth(s),
  ]);
  const EXPLORER: Record<Coin, (a: string) => string> = { xrp: (a) => `https://livenet.xrpl.org/accounts/${a}`, eth: (a) => `https://etherscan.io/address/${a}`, btc: (a) => `https://mempool.space/address/${a}`, ada: (a) => `https://cardanoscan.io/address/${a}` };
  const now = new Date();

  return (
    <div>
      <PageTitle back={{ href: '/leben', label: 'Leben' }} title="Finanzen" />

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

      <Section title="Krypto · nur ansehen" aside={<span className="mono text-xs text-muted">{(Object.entries(prices) as Array<[Coin, { eur: number }]>).map(([c, p]) => `1 ${c.toUpperCase()} = ${nf(p.eur, c === 'xrp' || c === 'ada' ? 4 : 0)} €`).join(' · ')}</span>}>
        <p className="notice notice-info mb-3 text-sm">
          🔒 Jarvis kennt nur deine <strong>öffentliche Adresse</strong> und kann damit nichts versenden. Deine 24 Wörter, PIN oder dein Ledger werden nie gebraucht – wer danach fragt, will dich betrügen.
        </p>

        {wallets.length > 0 && (
          <div className="card mb-3 grid gap-1">
            <p className="eyebrow">Krypto gesamt</p>
            <p className="text-2xl font-bold">{nf(nw.crypto.aed, 0)} AED</p>
            <p className="text-muted">{nw.eurAed ? `≈ ${nf(nw.crypto.aed / nw.eurAed, 0)} € · ` : ''}{Object.entries(nw.crypto.holdings).filter(([, v]) => v != null).sort(([a], [b]) => ['BTC', 'ETH', 'XRP', 'ADA', 'USDT', 'USDC'].indexOf(a) - ['BTC', 'ETH', 'XRP', 'ADA', 'USDT', 'USDC'].indexOf(b)).map(([k, v]) => `${nf(v ?? 0, k === 'BTC' ? 8 : k === 'ETH' ? 4 : 2)} ${k}`).join(' · ')}</p>
            {nw.crypto.error && <p className="text-sm text-warn">Ein Teil ist gerade ohne Kurs oder Netz – nicht mitgezählt.</p>}
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
            const amount = x ? x.xrp : e ? e.eth : b ? b.btc : c!.ada;
            const stableUsd = e ? e.tokens.reduce((n, t) => n + (Number.isFinite(t.amount) ? t.amount : 0), 0) : 0;
            return (
              <li key={w.id} className="card grid gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{w.label} <span className="mono text-xs text-muted">{sym}</span></p>
                    <a className="mono break-all text-xs text-sea underline" href={EXPLORER[w.chain](w.address)} target="_blank" rel="noopener noreferrer">{short(w.address)} ↗</a>
                  </div>
                  <div className="text-right">
                    {v.error ? <p className="text-sm text-warn">{v.error}</p>
                      : x && !x.activated ? <p className="text-sm text-muted">Noch nicht aktiviert (0 XRP)</p>
                      : <>
                        <p className="text-lg font-bold">{nf(amount, DEC[w.chain])} {sym}</p>
                        {p && <p className="text-sm text-muted">≈ {nf(amount * p.eur + (nw.eurAed ? (stableUsd * AED_PER_USD) / nw.eurAed : 0))} €</p>}
                      </>}
                  </div>
                </div>
                {e && e.tokens.length > 0 && !e.error && (
                  <p className="text-sm">{e.tokens.map((t) => Number.isFinite(t.amount) ? `+ ${nf(t.amount, 2)} ${t.symbol}` : `${t.symbol}: nicht abrufbar`).join(' · ')}</p>
                )}
                {e && !e.error && <p className="text-xs text-muted">Gezählt: ETH, USDT und USDC. Andere Tokens/NFTs siehst du über den Etherscan-Link.</p>}
                {c && !c.error && (
                  <p className="text-xs text-muted">
                    {c.whole ? `Ganzes Cardano-Konto (alle Adressen) inkl. ${nf(c.rewardsAda, 2)} ADA Staking-Belohnungen.` : 'Nur diese Adresse (ohne Staking-Teil).'}
                    {c.delegatedPool ? ' Gestaked.' : c.whole ? ' Nicht gestaked.' : ''}
                  </p>
                )}
                {b && !b.error && (
                  <>
                    {b.pendingBtc !== 0 && <p className="text-xs text-warn">Unbestätigt: {b.pendingBtc > 0 ? '+' : ''}{nf(b.pendingBtc, 8)} BTC</p>}
                    {b.btc === 0 && (
                      <p className="notice notice-warn text-sm">
                        {b.txCount > 0
                          ? `Auf dieser Adresse liegt gerade 0 BTC – sie wurde schon ${b.txCount}× benutzt und ist inzwischen leer. Ledger Live nimmt für jeden Empfang eine neue Adresse; dein Bitcoin liegt also vermutlich auf neueren Adressen.`
                          : 'Diese Adresse wurde noch nie benutzt (0 BTC). Ledger Live verteilt Bitcoin auf mehrere Adressen.'}
                      </p>
                    )}
                    <p className="text-xs text-muted">Zeigt nur diese eine Adresse. Ledger Live verteilt Bitcoin oft auf mehrere Adressen – stimmt der Betrag nicht mit Ledger Live überein, füge die weiteren Adressen hinzu.</p>
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

        <div className="mt-3">
          <ConnectSection initialOpen={wallets.length === 0} title="+ Wallet-Adresse hinzufügen (BTC / ETH / XRP / ADA)">
            <div className="mt-3"><AddWalletForm /></div>
          </ConnectSection>
        </div>
      </Section>

      <Section title="Kontoauszüge">
        <div className="card grid gap-2">
          <p className="text-muted">Kontoauszug-Import (CSV/XLSX) kommt als Nächstes – dann hakt Jarvis z. B. die Lager-Miete automatisch ab, sobald die Zahlung auf dem Auszug steht.</p>
          <p className="notice notice-info text-sm">Jarvis fragt nie nach Bank-Passwörtern. Du lädst nur Exporte hoch.</p>
        </div>
      </Section>
    </div>
  );
}
