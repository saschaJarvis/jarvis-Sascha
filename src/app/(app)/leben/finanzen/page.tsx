import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { loadXrpAccount, xrpPrice } from '@/server/wallets';
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
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default async function FinancePage() {
  const s = await requireUser();
  const wallets = await db(s).run((q) => q<{ id: string; chain: string; address: string; label: string }>(
    'select id, chain, address, label from crypto_wallets where deleted_at is null order by created_at'));
  const [accounts, price, nw] = await Promise.all([Promise.all(wallets.map((w) => loadXrpAccount(w.address))), wallets.length ? xrpPrice() : null, loadNetWorth(s)]);
  const total = accounts.reduce((n, a) => n + (Number.isFinite(a.xrp) ? a.xrp : 0), 0);
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

      <Section title="Krypto · nur ansehen" aside={price ? <span className="mono text-xs text-muted">1 XRP = {nf(price.eur, 4)} € · {nf(price.aed, 3)} AED</span> : null}>
        <p className="notice notice-info mb-3 text-sm">
          🔒 Jarvis kennt nur deine <strong>öffentliche Adresse</strong> und kann damit nichts versenden. Deine 24 Wörter, PIN oder dein Ledger werden nie gebraucht – wer danach fragt, will dich betrügen.
        </p>

        {wallets.length > 0 && (
          <div className="card mb-3 grid gap-1">
            <p className="eyebrow">Gesamt</p>
            <p className="text-2xl font-bold">{nf(total, 2)} XRP</p>
            {price
              ? <p className="text-muted">≈ {nf(total * price.eur)} € · {nf(total * price.aed)} AED <span className="text-xs">({price.source})</span></p>
              : <p className="text-sm text-muted">Kurs gerade nicht abrufbar.</p>}
          </div>
        )}

        <ul className="grid gap-3">
          {wallets.map((w, i) => {
            const a = accounts[i];
            return (
              <li key={w.id} className="card grid gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{w.label} <span className="mono text-xs text-muted">XRP</span></p>
                    <a className="mono break-all text-xs text-sea underline" href={`https://livenet.xrpl.org/accounts/${w.address}`} target="_blank" rel="noopener noreferrer">{short(w.address)} ↗</a>
                  </div>
                  <div className="text-right">
                    {a.error ? <p className="text-sm text-warn">{a.error}</p>
                      : !a.activated ? <p className="text-sm text-muted">Noch nicht aktiviert (0 XRP)</p>
                      : <>
                        <p className="text-lg font-bold">{nf(a.xrp, 2)} XRP</p>
                        {price && <p className="text-sm text-muted">≈ {nf(a.xrp * price.eur)} €</p>}
                      </>}
                  </div>
                </div>
                {a.reserveXrp != null && a.activated && !a.error && (
                  <p className="text-xs text-muted">Davon {nf(a.reserveXrp, 1)} XRP als Mindestreserve des XRP Ledgers gebunden.</p>
                )}
                {a.moves.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm text-sea">Letzte Bewegungen ({a.moves.length})</summary>
                    <ul className="mt-2 grid gap-1 text-sm">
                      {a.moves.map((m) => (
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
          <ConnectSection initialOpen={wallets.length === 0} title="+ XRP-Adresse hinzufügen">
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
