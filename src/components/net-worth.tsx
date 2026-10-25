import Link from 'next/link';
import type { NetWorth } from '@/server/networth';

const nf = (n: number, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Gesamtvermögen: Konten + Krypto + Gold + Platin + Silber + Aktien. Basis AED, dazu EUR. Fehlende Kurse werden genannt, nie geschätzt. */
export function NetWorthBlock({ nw, compact = false }: { nw: NetWorth; compact?: boolean }) {
  const parts = [
    { key: 'konten', label: 'Konten', aed: nw.accounts.aed, n: nw.accounts.count, sub: `${nw.accounts.count} Konto${nw.accounts.count === 1 ? '' : 'en'}`, color: 'bg-sea' },
    { key: 'krypto', label: 'Krypto', aed: nw.crypto.aed, n: nw.crypto.count, sub: nw.crypto.count ? `${Object.values(nw.crypto.holdings).filter((v) => v != null && v > 0).length} Coins` : 'keine Wallets', color: 'bg-good' },
    { key: 'gold', label: 'Gold', aed: nw.gold.aed, n: nw.gold.count, sub: nw.gold.count ? `${nw.gold.pieces} Stk · ${nf(nw.gold.grams, nw.gold.grams % 1 ? 1 : 0)} g` : 'kein Gold', color: 'bg-warn' },
    { key: 'platin', label: 'Platin', aed: nw.platinum.aed, n: nw.platinum.count, sub: nw.platinum.count ? `${nf(nw.platinum.grams / 31.1034768, 2)} oz` : 'kein Platin', color: 'bg-[#c9d6df]' },
    { key: 'silber', label: 'Silber', aed: nw.silver.aed, n: nw.silver.count, sub: nw.silver.count ? `${nw.silver.pieces} Stk · ${nf(nw.silver.grams / 31.1034768, 0)} oz` : 'kein Silber', color: 'bg-[#9aa7b4]' },
    { key: 'aktien', label: 'Aktien', aed: nw.stocks.aed, n: nw.stocks.count, sub: nw.stocks.count ? `${nw.stocks.count} Position${nw.stocks.count === 1 ? '' : 'en'}` : 'keine Aktien', color: 'bg-[#b48cff]' },
  ];
  const pos = parts.reduce((n, p) => n + Math.max(0, p.aed), 0);
  const empty = parts.every((p) => p.n === 0);

  return (
    <div className="grid gap-3">
      <div>
        <p className="mono text-[.65rem] uppercase tracking-[.18em] text-muted">Gesamtvermögen</p>
        <p className={`hud-num ${compact ? 'text-3xl' : 'text-4xl'} font-semibold leading-tight text-sea glow`}>{empty ? '—' : `${nf(nw.totalAed)} AED`}</p>
        {!empty && <p className="mono text-sm text-muted">{nw.totalEur != null ? `≈ ${nf(nw.totalEur)} €` : '€-Kurs gerade nicht abrufbar'}</p>}
      </div>

      {pos > 0 && (
        <div className="flex h-2 gap-[2px]" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round((Math.max(0, p.aed) / pos) * 100)} %`).join(', ')}>
          {parts.filter((p) => p.aed > 0).map((p) => <span key={p.key} className={p.color} style={{ width: `${(p.aed / pos) * 100}%` }} />)}
        </div>
      )}

      <dl className="grid grid-cols-3 gap-2">
        {parts.map((p) => (
          <div key={p.key} className="border-l border-line pl-2">
            <dt className="mono flex items-center gap-1 text-[.6rem] uppercase tracking-[.16em] text-muted"><span className={`h-1.5 w-1.5 ${p.color}`} />{p.label}</dt>
            <dd className="hud-num text-[.95rem] font-semibold">{p.n ? nf(p.aed) : '—'}</dd>
            <dd className="mono text-[.6rem] text-muted">{p.sub}</dd>
          </div>
        ))}
      </dl>

      {nw.crypto.change && <CryptoChange ch={nw.crypto.change} asOf={nw.crypto.asOf} />}
      {nw.gold.change && <CryptoChange ch={nw.gold.change} label="Gold 24 h" />}
      {nw.silver.change && <CryptoChange ch={nw.silver.change} label="Silber 24 h" />}
      {nw.platinum.change && <CryptoChange ch={nw.platinum.change} label="Platin 24 h" />}

      {nw.missing > 0 && <p className="text-xs text-warn">▲ {nw.missing} Posten ohne aktuellen Kurs – nicht mitgezählt.</p>}
      {empty && <p className="text-sm text-muted">Noch nichts erfasst. Konten, Krypto, Gold, Platin, Silber und Aktien trägst du unter Finanzen ein.</p>}
    </div>
  );
}

export function NetWorthCard({ nw }: { nw: NetWorth }) {
  return (
    <div className="card mb-5">
      <NetWorthBlock nw={nw} />
      <p className="mt-3 text-xs text-muted">In AED gerechnet (USD fest 3,6725; EUR nach EZB-Kurs). Wohnung und Hypothek sind nicht enthalten. <Link href="/leben/dubai" className="underline">Wohnung</Link></p>
    </div>
  );
}

const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±');

/** „Krypto 24 h: ▲ +2,3 % · +450 € · +1.800 AED“ */
export function CryptoChange({ ch, asOf, label = 'Krypto 24 h' }: { ch: NonNullable<NetWorth['crypto']['change']>; asOf?: Date; label?: string }) {
  const up = ch.aed > 0, down = ch.aed < 0;
  const tone = up ? 'text-good' : down ? 'text-bad' : 'text-muted';
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-l-2 pl-2 text-sm" style={{ borderColor: 'currentColor' }}>
      <span className="mono text-[.62rem] uppercase tracking-[.16em] text-muted">{label}</span>
      <span className={`hud-num font-semibold ${tone}`}>
        {up ? '▲' : down ? '▼' : '■'} {ch.pct != null ? `${sign(ch.pct)}${nf(Math.abs(ch.pct) * 100, 2)} %` : '–'}
        {ch.eur != null && ` · ${sign(ch.eur)}${nf(Math.abs(ch.eur))} €`}
        {` · ${sign(ch.aed)}${nf(Math.abs(ch.aed))} AED`}
      </span>
      {asOf && <span className="mono text-[.6rem] text-muted" suppressHydrationWarning>Stand {asOf.toLocaleTimeString('de-DE', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
      {!ch.complete && <span className="text-xs text-warn">teilweise ohne 24-h-Wert</span>}
    </div>
  );
}
