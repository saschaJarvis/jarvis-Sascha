'use client';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { fxHistoryAction } from '@/app/(app)/history-actions';

/**
 * €/AED-Kurskarte: großer Kurs, Umkehrkurs, Veränderung, Verlauf (24 h bis 5 Jahre), Hoch/Tief und Umrechner.
 * Der Dirham ist fest an den US-Dollar gebunden – der Kurs bewegt sich nur mit EUR/USD.
 */

export interface FxView { eurAed: number; changePct: number | null; live: boolean; at: string; date: string; source: string }

type Range = '24h' | '7d' | '1m' | '1y' | '5y';
const RANGES: Array<{ k: Range; label: string; long: string; span: number }> = [
  { k: '24h', label: '24 H', long: '24 Stunden', span: 86_400_000 },
  { k: '7d', label: '7 T', long: '7 Tage', span: 7 * 86_400_000 },
  { k: '1m', label: '1 M', long: '1 Monat', span: 30 * 86_400_000 },
  { k: '1y', label: '1 J', long: '1 Jahr', span: 365 * 86_400_000 },
  { k: '5y', label: '5 J', long: '5 Jahre', span: 5 * 365 * 86_400_000 },
];
const COLOR = '#3fd2ff';

const nf = (n: number, d = 4) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±');

export function FxCard({ fx, compact = false }: { fx: FxView | null; compact?: boolean }) {
  const [range, setRange] = useState<Range>('24h');
  const [data, setData] = useState<Partial<Record<Range, number[] | null>>>({});
  const [pending, start] = useTransition();
  const asked = useRef(new Set<Range>());

  const load = (r: Range) => {
    if (asked.current.has(r)) return;
    asked.current.add(r);
    start(async () => {
      const s = await fxHistoryAction(r).catch(() => null);
      setData((d) => ({ ...d, [r]: s }));
      if (!s) asked.current.delete(r);
    });
  };
  useEffect(() => { load('24h'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fx) return <p className="mono text-xs text-warn">€/AED-Kurs gerade nicht abrufbar</p>;

  const meta = RANGES.find((x) => x.k === range)!;
  // Letzter Punkt = aktueller Live-Kurs, damit Karte und Verlauf übereinstimmen
  const raw = data[range];
  const series = raw && raw.length > 1 ? [...raw.slice(0, -1), fx.eurAed] : null;
  const first = series?.[0] ?? null;
  const pct = first ? fx.eurAed / first - 1 : range === '24h' ? fx.changePct : null;
  const up = (pct ?? 0) > 0, down = (pct ?? 0) < 0;
  const tone = up ? 'text-good' : down ? 'text-bad' : 'text-muted';
  const hi = series ? Math.max(...series) : null, lo = series ? Math.min(...series) : null;
  const busy = pending && data[range] === undefined;

  return (
    <section aria-label="Wechselkurs Euro zu Dirham" className="grid gap-2 border border-line bg-card/60 p-3" style={{ borderTopColor: COLOR, borderTopWidth: 2 }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="mono text-[.62rem] font-semibold uppercase tracking-[.18em] text-ink">€ → AED · Wechselkurs</span>
        <span className="mono flex items-center gap-1.5 text-[.6rem] uppercase tracking-[.14em]">
          {fx.live
            ? <><span className="blink inline-block h-1.5 w-1.5 rounded-full bg-good" /><span className="text-good">live</span></>
            : <span className="text-warn">EZB {fx.date}</span>}
          <span className="text-muted normal-case tracking-normal" suppressHydrationWarning>
            {new Date(fx.at).toLocaleTimeString('de-DE', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div>
          <p className="hud-num leading-none">
            <span className="text-sm text-muted">1 € = </span>
            <span className="text-[2rem] font-semibold text-sea glow">{nf(fx.eurAed)}</span>
            <span className="text-sm text-muted"> AED</span>
          </p>
          <p className="hud-num mt-1 text-[.72rem] text-muted">1 AED = {nf(1 / fx.eurAed)} €</p>
        </div>
        {pct != null && (
          <div className="text-right">
            <span className={`hud-num whitespace-nowrap rounded-sm px-2 py-1 text-sm font-semibold ${tone} ${up ? 'bg-good-soft' : down ? 'bg-bad-soft' : 'bg-sand'}`}>
              {up ? '▲' : down ? '▼' : '■'} {sign(pct)}{nf(Math.abs(pct) * 100, 2)} %
            </span>
            <p className="mono mt-1 text-[.58rem] uppercase tracking-wider text-muted">
              {first ? <>{sign(fx.eurAed - first)}{nf(Math.abs(fx.eurAed - first))} · {meta.long}</> : 'seit Tagesbeginn'}
            </p>
          </div>
        )}
      </div>

      <div role="radiogroup" aria-label="Zeitraum" className="flex w-fit border border-line">
        {RANGES.map((r) => (
          <button key={r.k} type="button" role="radio" aria-checked={range === r.k} onClick={() => { setRange(r.k); load(r.k); }}
            className={`mono min-h-8 px-2.5 text-[.62rem] font-semibold tracking-wider ${range === r.k ? 'bg-sea-soft text-sea glow' : 'text-muted hover:text-ink'}`}>
            {r.label}
          </button>
        ))}
      </div>

      {series ? <FxSpark series={series} range={meta} /> : (
        <div className="grid h-[5.2rem] place-items-center text-[.65rem] text-muted">{busy ? <span className="blink">▮▮▮</span> : 'Verlauf gerade nicht abrufbar'}</div>
      )}
      {hi != null && lo != null && (
        <div className="hud-num flex justify-between text-[.68rem]">
          <span className="text-muted">Tief <span className="text-ink">{nf(lo)}</span></span>
          <span className="text-muted">Spanne <span className="text-ink">{nf(((hi - lo) / lo) * 100, 2)} %</span></span>
          <span className="text-muted">Hoch <span className="text-ink">{nf(hi)}</span></span>
        </div>
      )}

      {!compact && <Converter rate={fx.eurAed} />}
      {!compact && <p className="text-[.6rem] text-muted">Der Dirham ist fest an den US-Dollar gebunden (1 USD = 3,6725 AED) – der Kurs bewegt sich nur mit EUR/USD. Quelle: {fx.source}.</p>}
    </section>
  );
}

function FxSpark({ series, range }: { series: number[]; range: (typeof RANGES)[number] }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const W = 300, H = 72, P = 4;
  const min = Math.min(...series), max = Math.max(...series);
  const span = max - min || max * 0.0005 || 1;
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => P + (1 - (v - min) / span) * (H - 2 * P);
  const line = `M${series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('L')}`;
  const hi = hover ?? series.length - 1;
  const when = (i: number) => {
    const ago = ((series.length - 1 - i) / (series.length - 1)) * range.span;
    if (ago < 60_000) return 'jetzt';
    const d = new Date(Date.now() - ago);
    if (range.k === '24h') return d.toLocaleTimeString('de-DE', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit' });
    if (range.k === '7d') return d.toLocaleString('de-DE', { timeZone: 'Asia/Dubai', weekday: 'short', hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('de-DE', { timeZone: 'Asia/Dubai', day: '2-digit', month: '2-digit', year: '2-digit' });
  };
  const pick = (cx: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    setHover(Math.max(0, Math.min(series.length - 1, Math.round(((cx - r.left) / r.width) * (series.length - 1)))));
  };
  const d = series[hi] - series[0];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[4.5rem] w-full touch-none" role="img"
        aria-label={`€/AED ${range.long}: von ${nf(series[0])} auf ${nf(series[series.length - 1])}`}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerDown={(e) => pick(e.clientX, e.currentTarget)} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`f${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR} stopOpacity=".32" /><stop offset="100%" stopColor={COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={y(series[0])} y2={y(series[0])} stroke="#7f9db1" strokeOpacity=".45" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#f${id})`} />
        <path d={line} fill="none" stroke={COLOR} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {hover != null && <line x1={x(hi)} x2={x(hi)} y1="0" y2={H} stroke="#d8edf8" strokeOpacity=".5" vectorEffect="non-scaling-stroke" />}
      </svg>
      <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-paper"
        style={{ left: `${(x(hi) / W) * 100}%`, top: `${(y(series[hi]) / H) * 100}%`, background: COLOR, boxShadow: `0 0 8px ${COLOR}` }} />
      <div className="mono mt-0.5 flex justify-between text-[.58rem] text-muted">
        {hover == null ? <><span>−{range.long}</span><span>jetzt</span></> : (
          <span className="w-full text-center text-ink" suppressHydrationWarning>{when(hi)} · {nf(series[hi])} AED · <span className={d > 0 ? 'text-good' : d < 0 ? 'text-bad' : ''}>{sign(d)}{nf(Math.abs(d))}</span></span>
        )}
      </div>
    </div>
  );
}

/** Umrechner € ↔ AED zum aktuellen Kurs. */
function Converter({ rate }: { rate: number }) {
  const [eur, setEur] = useState('1.000');
  const [aed, setAed] = useState(() => fmt(1000 * rate));
  const [last, setLast] = useState<'eur' | 'aed'>('eur');
  // Kurs ändert sich live → die zuletzt nicht getippte Seite nachziehen
  useEffect(() => {
    if (last === 'eur') setAed(fmt(parse(eur) * rate)); else setEur(fmt(parse(aed) / rate));
  }, [rate]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-line pt-2">
      <label className="relative">
        <span className="sr-only">Euro</span>
        <input inputMode="decimal" value={eur} onChange={(e) => { setEur(e.target.value); setLast('eur'); setAed(fmt(parse(e.target.value) * rate)); }}
          className="field hud-num min-h-10 pr-7 text-right" />
        <span className="mono pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted">€</span>
      </label>
      <span className="text-sea" aria-hidden="true">⇄</span>
      <label className="relative">
        <span className="sr-only">Dirham</span>
        <input inputMode="decimal" value={aed} onChange={(e) => { setAed(e.target.value); setLast('aed'); setEur(fmt(parse(e.target.value) / rate)); }}
          className="field hud-num min-h-10 pr-11 text-right" />
        <span className="mono pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted">AED</span>
      </label>
    </div>
  );
}
const parse = (s: string) => { const n = Number(s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };
const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
