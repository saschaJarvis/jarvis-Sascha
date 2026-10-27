'use client';
import { useId, useState } from 'react';

/**
 * Grafiken fürs Vermögen: 24-h-Verlaufskarten (Krypto, Gold, Silber, Platin) und Kuchen (Aufteilung).
 * Farben je Anlageklasse fest (nie nach Rang), geprüft auf Farbsehschwäche gegen den dunklen Hintergrund.
 */

import { ASSET_COLOR, type Slice } from './asset-colors';
export { ASSET_COLOR };

const nf = (n: number, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±');
const short = (n: number) => (Math.abs(n) >= 1e6 ? `${nf(n / 1e6, 2)} Mio.` : Math.abs(n) >= 1e4 ? `${nf(n / 1e3, 0)} Tsd.` : nf(n));

export interface Change { aed: number; eur: number | null; pct: number | null; complete: boolean }
export interface TrendItem { key: keyof typeof ASSET_COLOR; label: string; aed: number; change: Change | null; series: number[] | null; note?: string }

// ───────────────────────── 24-h-Karten ─────────────────────────

export function TrendGrid({ items, asOf }: { items: TrendItem[]; asOf?: string }) {
  const shown = items.filter((i) => i.change || i.series);
  if (!shown.length) return null;
  return (
    <section aria-label="Kursverlauf 24 Stunden" className="grid gap-2">
      <div className="flex items-baseline justify-between">
        <p className="mono text-[.62rem] uppercase tracking-[.18em] text-muted">Märkte · letzte 24 h</p>
        {asOf && <p className="mono text-[.6rem] text-muted" suppressHydrationWarning>Stand {asOf}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {shown.map((i) => <TrendCard key={i.key} item={i} />)}
      </div>
    </section>
  );
}

function TrendCard({ item }: { item: TrendItem }) {
  const ch = item.change;
  const up = (ch?.aed ?? 0) > 0, down = (ch?.aed ?? 0) < 0;
  const tone = up ? 'text-good' : down ? 'text-bad' : 'text-muted';
  const pill = up ? 'bg-good-soft' : down ? 'bg-bad-soft' : 'bg-sand';
  return (
    <div className="relative grid gap-1 border border-line bg-card/60 p-2.5" style={{ borderTopColor: ASSET_COLOR[item.key], borderTopWidth: 2 }}>
      <div className="flex items-center justify-between gap-1">
        <span className="mono flex items-center gap-1.5 text-[.62rem] font-semibold uppercase tracking-[.16em] text-ink">
          <span className="h-2 w-2 rounded-full" style={{ background: ASSET_COLOR[item.key] }} />{item.label}
        </span>
        {ch?.pct != null && (
          <span className={`hud-num rounded-sm px-1.5 py-0.5 text-[.72rem] font-semibold ${tone} ${pill}`}>
            {up ? '▲' : down ? '▼' : '■'} {sign(ch.pct)}{nf(Math.abs(ch.pct) * 100, 2)} %
          </span>
        )}
      </div>
      <p className="hud-num text-[1.05rem] font-semibold leading-tight text-ink">{nf(item.aed)} <span className="text-[.7rem] text-muted">AED</span></p>
      {ch && (
        <p className={`hud-num text-[.7rem] ${tone}`}>
          {ch.eur != null && <>{sign(ch.eur)}{nf(Math.abs(ch.eur))} € · </>}{sign(ch.aed)}{nf(Math.abs(ch.aed))} AED
        </p>
      )}
      {item.series && item.series.length > 1 ? <Spark series={item.series} color={ASSET_COLOR[item.key]} label={item.label} /> : <p className="py-3 text-center text-[.65rem] text-muted">Verlauf gerade nicht abrufbar</p>}
      {(item.note || (ch && !ch.complete)) && <p className="text-[.62rem] text-warn">{item.note ?? 'teilweise ohne 24-h-Wert'}</p>}
    </div>
  );
}

/** Flächen-Sparkline mit Fadenkreuz und Wert beim Antippen/Überfahren. */
function Spark({ series, color, label }: { series: number[]; color: string; label: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 200, H = 56, P = 3;
  const min = Math.min(...series), max = Math.max(...series);
  const span = max - min || Math.abs(max) * 0.001 || 1;
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => P + (1 - (v - min) / span) * (H - 2 * P);
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = `M${pts.join('L')}`;
  const area = `${line}L${W},${H}L0,${H}Z`;
  const base = y(series[0]);
  const hi = hover ?? series.length - 1;
  const hoursAgo = series.length - 1 - hi;
  const delta = series[hi] - series[0];

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const i = Math.round(((clientX - r.left) / r.width) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, i)));
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-14 w-full touch-none"
        role="img" aria-label={`${label}: Verlauf 24 Stunden, von ${nf(series[0])} auf ${nf(series[series.length - 1])} AED`}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerDown={(e) => pick(e.clientX, e.currentTarget)} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity=".38" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={base} y2={base} stroke="#7f9db1" strokeOpacity=".45" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <path d={area} fill={`url(#g${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover != null && <line x1={x(hi)} x2={x(hi)} y1="0" y2={H} stroke="#d8edf8" strokeOpacity=".5" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* Punkt als HTML, damit er trotz gestreckter SVG rund bleibt */}
      <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper"
        style={{ left: `${(x(hi) / W) * 100}%`, top: `${(y(series[hi]) / H) * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      <div className="mono mt-0.5 flex justify-between text-[.58rem] text-muted">
        {hover == null ? <><span>−24 h</span><span>jetzt</span></> : (
          <span className="w-full text-center text-ink">{hoursAgo === 0 ? 'jetzt' : `vor ${hoursAgo} h`} · {nf(series[hi])} AED · <span className={delta > 0 ? 'text-good' : delta < 0 ? 'text-bad' : ''}>{sign(delta)}{short(Math.abs(delta))}</span></span>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Kuchen ─────────────────────────

export function Donut({ title, slices, centerLabel, centerValue }: { title: string; slices: Slice[]; centerLabel: string; centerValue: string }) {
  const [active, setActive] = useState<number | null>(null);
  const data = slices.filter((s) => s.aed > 0);
  const total = data.reduce((n, s) => n + s.aed, 0);
  if (!total) return null;
  const R = 46, C = 2 * Math.PI * R, GAP = data.length > 1 ? 2 : 0;
  let acc = 0;
  const segs = data.map((s) => {
    const len = (s.aed / total) * C;
    const seg = { ...s, start: acc, len, pct: s.aed / total };
    acc += len;
    return seg;
  });
  const a = active != null ? segs[active] : null;

  return (
    <figure className="grid gap-2" aria-label={title}>
      <figcaption className="mono text-[.62rem] uppercase tracking-[.18em] text-muted">{title}</figcaption>
      <div className="flex items-center gap-3">
        <div className="relative w-[46%] max-w-40 shrink-0">
          <svg viewBox="0 0 120 120" className="block w-full -rotate-90" role="img" aria-label={segs.map((s) => `${s.label} ${nf(s.pct * 100, 1)} %`).join(', ')}>
            <circle cx="60" cy="60" r={R} fill="none" stroke="#143449" strokeWidth="14" />
            {segs.map((s, i) => (
              <circle key={s.key} cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth={active === i ? 18 : 14}
                strokeDasharray={`${Math.max(0.5, s.len - GAP)} ${C}`} strokeDashoffset={-s.start}
                style={{ transition: 'stroke-width .15s', filter: active === i ? `drop-shadow(0 0 4px ${s.color})` : undefined, cursor: 'pointer' }}
                onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onClick={() => setActive(active === i ? null : i)} />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="mono text-[.55rem] uppercase tracking-[.14em] text-muted">{a ? a.label : centerLabel}</span>
            <span className="hud-num text-[.82rem] font-semibold leading-tight text-ink">{a ? `${nf(a.pct * 100, 1)} %` : centerValue}</span>
            {a && <span className="hud-num text-[.6rem] text-muted">{short(a.aed)} AED</span>}
          </div>
        </div>
        <ul className="grid min-w-0 flex-1 gap-1">
          {segs.map((s, i) => (
            <li key={s.key}>
              <button type="button" onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} onClick={() => setActive(active === i ? null : i)}
                className={`flex w-full items-center gap-1.5 text-left text-[.7rem] ${active != null && active !== i ? 'opacity-50' : ''}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-ink">{s.label}</span>
                <span className="hud-num text-muted">{nf(s.pct * 100, s.pct < 0.1 ? 1 : 0)} %</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

