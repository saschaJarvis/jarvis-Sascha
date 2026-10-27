'use client';
import { useId, useRef, useState, useTransition } from 'react';
import { assetHistoryAction, type RangeSeries } from '@/app/(app)/history-actions';

/**
 * Grafiken fürs Vermögen: Verlaufskarten (Krypto, Gold, Silber, Platin) mit Zeitraum 24 h / 7 T / 1 M / 1 J
 * und Kuchen (Aufteilung). Farben je Anlageklasse fest (nie nach Rang), geprüft auf Farbsehschwäche.
 */

import { ASSET_COLOR, type Slice } from './asset-colors';
export { ASSET_COLOR };

const nf = (n: number, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±');
const short = (n: number) => (Math.abs(n) >= 1e6 ? `${nf(n / 1e6, 2)} Mio.` : Math.abs(n) >= 1e4 ? `${nf(n / 1e3, 0)} Tsd.` : nf(n));

export interface Change { aed: number; eur: number | null; pct: number | null; complete: boolean }
type Key = 'krypto' | 'gold' | 'silber' | 'platin';
export interface TrendItem { key: Key; label: string; aed: number; change: Change | null; series: number[] | null }
export interface Holdings { coins: Array<{ coin: string; aed: number }>; stableAed: number; gold: number; silver: number; platinum: number }

type Range = '24h' | '7d' | '1m' | '1y' | '3y' | '5y';
const RANGES: Array<{ k: Range; label: string; long: string; span: number }> = [
  { k: '24h', label: '24 H', long: 'letzte 24 h', span: 86_400_000 },
  { k: '7d', label: '7 T', long: 'letzte 7 Tage', span: 7 * 86_400_000 },
  { k: '1m', label: '1 M', long: 'letzter Monat', span: 30 * 86_400_000 },
  { k: '1y', label: '1 J', long: 'letztes Jahr', span: 365 * 86_400_000 },
  { k: '3y', label: '3 J', long: 'letzte 3 Jahre', span: 3 * 365 * 86_400_000 },
  { k: '5y', label: '5 J', long: 'letzte 5 Jahre', span: 5 * 365 * 86_400_000 },
];

// ───────────────────────── Verlaufskarten ─────────────────────────

export function TrendGrid({ items, asOf, holdings, eurAed }: { items: TrendItem[]; asOf?: string; holdings: Holdings; eurAed: number | null }) {
  const [range, setRange] = useState<Range>('24h');
  const [data, setData] = useState<Partial<Record<Range, Record<Key, RangeSeries>>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const loading = useRef<Set<Range>>(new Set());
  const shown = items.filter((i) => i.change || i.series);
  if (!shown.length) return null;

  const choose = (r: Range) => {
    setRange(r);
    setError(null);
    if (r === '24h' || data[r] || loading.current.has(r)) return;
    loading.current.add(r);
    start(async () => {
      const res = await assetHistoryAction({ range: r, ...holdings }).catch(() => ({ error: 'Verlauf gerade nicht abrufbar.' }));
      loading.current.delete(r);
      if ('error' in res) setError(res.error);
      else setData((d) => ({ ...d, [r]: res }));
    });
  };
  const next = () => choose(RANGES[(RANGES.findIndex((x) => x.k === range) + 1) % RANGES.length].k);
  const meta = RANGES.find((x) => x.k === range)!;
  const busy = pending && range !== '24h' && !data[range];

  // Für 24 h die Live-Werte, sonst aus dem geladenen Verlauf (Wert jetzt − Wert am Anfang)
  const view = shown.map((it) => {
    if (range === '24h') return { ...it, note: it.change && !it.change.complete ? 'teilweise ohne 24-h-Wert' : undefined };
    const rs = data[range]?.[it.key];
    const s = rs?.series ?? null;
    const abs = s ? s[s.length - 1] - s[0] : 0;
    const change: Change | null = s ? { aed: abs, eur: eurAed ? abs / eurAed : null, pct: s[0] > 0 ? s[s.length - 1] / s[0] - 1 : null, complete: rs!.complete } : null;
    return { ...it, series: s, change, note: rs && !rs.complete ? 'teilweise ohne Verlauf' : undefined };
  });

  return (
    <section aria-label={`Kursverlauf ${meta.long}`} className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="mono text-[.62rem] uppercase tracking-[.18em] text-muted">Märkte · {meta.long}</p>
        <div role="radiogroup" aria-label="Zeitraum" className="flex border border-line">
          {RANGES.map((r) => (
            <button key={r.k} type="button" role="radio" aria-checked={range === r.k} onClick={() => choose(r.k)}
              className={`mono min-h-8 px-2 text-[.62rem] font-semibold tracking-wider ${range === r.k ? 'bg-sea-soft text-sea glow' : 'text-muted hover:text-ink'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className={`grid grid-cols-2 gap-2 transition-opacity ${busy ? 'opacity-60' : ''}`} aria-busy={busy}>
        {view.map((i) => <TrendCard key={i.key} item={i} range={meta} busy={busy} onCycle={next} />)}
      </div>
      <div className="flex justify-between text-[.6rem] text-muted">
        <span>{busy ? 'Lade Verlauf …' : error ? <span className="text-warn">{error}</span> : 'Kasten antippen = nächster Zeitraum'}</span>
        {asOf && range === '24h' && <span className="mono" suppressHydrationWarning>Stand {asOf}</span>}
      </div>
      {range !== '24h' && <p className="text-[.6rem] text-muted">Mit deinen heutigen Beständen gerechnet – zeigt die Kursentwicklung, nicht Käufe oder Verkäufe.</p>}
    </section>
  );
}

function TrendCard({ item, range, busy, onCycle }: { item: TrendItem & { note?: string }; range: (typeof RANGES)[number]; busy: boolean; onCycle: () => void }) {
  const ch = item.change;
  const up = (ch?.aed ?? 0) > 0, down = (ch?.aed ?? 0) < 0;
  const tone = up ? 'text-good' : down ? 'text-bad' : 'text-muted';
  const pill = up ? 'bg-good-soft' : down ? 'bg-bad-soft' : 'bg-sand';
  return (
    <div role="button" tabIndex={0} onClick={onCycle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCycle(); } }}
      aria-label={`${item.label}: Zeitraum wechseln (jetzt ${range.long})`}
      className="relative grid cursor-pointer select-none gap-1 border border-line bg-card/60 p-2.5 transition-colors hover:border-[#2a6a90] active:scale-[.99]"
      style={{ borderTopColor: ASSET_COLOR[item.key], borderTopWidth: 2 }}>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="mono flex items-center gap-1.5 text-[.62rem] font-semibold uppercase tracking-[.12em] text-ink">
          <span className="h-2 w-2 rounded-full" style={{ background: ASSET_COLOR[item.key] }} />{item.label}
        </span>
        {ch?.pct != null ? (
          <span className={`hud-num whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[.7rem] font-semibold ${tone} ${pill}`}>
            {up ? '▲' : down ? '▼' : '■'} {sign(ch.pct)}{nf(Math.abs(ch.pct) * 100, 2)} %
          </span>
        ) : <span className="mono text-[.6rem] text-muted">{range.label}</span>}
      </div>
      <p className="hud-num text-[1.05rem] font-semibold leading-tight text-ink">{nf(item.aed)} <span className="text-[.7rem] text-muted">AED</span></p>
      <p className={`hud-num flex min-h-[1.05rem] flex-wrap gap-x-1.5 text-[.7rem] ${tone}`}>
        {ch && <>{ch.eur != null && <span className="whitespace-nowrap">{sign(ch.eur)}{nf(Math.abs(ch.eur))} €</span>}<span className="whitespace-nowrap">{sign(ch.aed)}{nf(Math.abs(ch.aed))} AED</span></>}
      </p>
      {item.series && item.series.length > 1
        ? <Spark series={item.series} color={ASSET_COLOR[item.key]} label={item.label} range={range} />
        : <div className="grid h-[4.4rem] place-items-center text-[.65rem] text-muted">{busy ? <span className="blink">▮▮▮</span> : 'Verlauf gerade nicht abrufbar'}</div>}
      {item.note && <p className="text-[.62rem] text-warn">{item.note}</p>}
    </div>
  );
}

/** Flächen-Sparkline mit Fadenkreuz und Wert beim Antippen/Überfahren (Antippen der Kurve wechselt NICHT den Zeitraum). */
function Spark({ series, color, label, range }: { series: number[]; color: string; label: string; range: (typeof RANGES)[number] }) {
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
  const delta = series[hi] - series[0];
  const when = (i: number) => {
    const ago = ((series.length - 1 - i) / (series.length - 1)) * range.span;
    if (ago < 60_000) return 'jetzt';
    if (range.k === '24h') return `vor ${Math.round(ago / 3_600_000)} h`;
    const d = new Date(Date.now() - ago);
    return range.k === '7d'
      ? d.toLocaleString('de-DE', { timeZone: 'Asia/Dubai', weekday: 'short', hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('de-DE', { timeZone: 'Asia/Dubai', day: '2-digit', month: '2-digit', ...(range.k === '1m' ? {} : { year: '2-digit' }) });
  };
  const startLabel = { '24h': '−24 h', '7d': '−7 T', '1m': '−1 M', '1y': '−1 J', '3y': '−3 J', '5y': '−5 J' }[range.k];

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const i = Math.round(((clientX - r.left) / r.width) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, i)));
  };

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-14 w-full touch-none"
        role="img" aria-label={`${label}: Verlauf ${range.long}, von ${nf(series[0])} auf ${nf(series[series.length - 1])} AED`}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerDown={(e) => { e.stopPropagation(); pick(e.clientX, e.currentTarget); }} onPointerLeave={() => setHover(null)}>
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
        {hover == null ? <><span>{startLabel}</span><span>jetzt</span></> : (
          <span className="w-full truncate text-center text-ink" suppressHydrationWarning>{when(hi)} · {short(series[hi])} AED · <span className={delta > 0 ? 'text-good' : delta < 0 ? 'text-bad' : ''}>{sign(delta)}{short(Math.abs(delta))}</span></span>
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

