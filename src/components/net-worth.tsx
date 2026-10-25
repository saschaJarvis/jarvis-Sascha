import Link from 'next/link';
import type { NetWorth } from '@/server/networth';

const nf = (n: number, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Gesamtvermögen: Konten + Krypto + Gold. Basis AED, dazu EUR. Fehlende Kurse werden genannt, nie geschätzt. */
export function NetWorthBlock({ nw, compact = false }: { nw: NetWorth; compact?: boolean }) {
  const parts = [
    { key: 'konten', label: 'Konten', aed: nw.accounts.aed, n: nw.accounts.count, sub: `${nw.accounts.count} Konto${nw.accounts.count === 1 ? '' : 'en'}`, color: 'bg-sea' },
    { key: 'krypto', label: 'Krypto', aed: nw.crypto.aed, n: nw.crypto.count, sub: nw.crypto.count ? Object.entries(nw.crypto.holdings).filter(([, v]) => v).map(([k, v]) => `${nf(v ?? 0, k === 'ETH' ? 2 : 0)} ${k}`).join(' · ') || '0' : 'keine Wallets', color: 'bg-good' },
    { key: 'gold', label: 'Gold', aed: nw.gold.aed, n: nw.gold.count, sub: nw.gold.count ? `${nf(nw.gold.grams, nw.gold.grams % 1 ? 1 : 0)} g` : 'kein Gold', color: 'bg-warn' },
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

      {nw.missing > 0 && <p className="text-xs text-warn">▲ {nw.missing} Posten ohne aktuellen Kurs – nicht mitgezählt.</p>}
      {empty && <p className="text-sm text-muted">Noch nichts erfasst. Konten, Krypto und Gold trägst du unter Finanzen ein.</p>}
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
