'use client';
import { useEffect, useMemo, useState } from 'react';
import { DUBAI, moonState, sunVector, type MoonState } from '@/lib/moon';

/** Aktualisiert jede Minute; startet mit der Serverzeit, damit Server- und Browserbild identisch sind. */
function useNow(initialNow: number, everyMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}
function useMoon(initialNow: number): { now: Date; m: MoonState } {
  const now = useNow(initialNow);
  const m = useMemo(() => moonState(now, DUBAI), [Math.floor(now.getTime() / 60_000)]); // eslint-disable-line react-hooks/exhaustive-deps
  return { now, m };
}

// Punktkugel (Fibonacci), nur Vorderseite – deterministisch
const DOTS = (() => {
  const pts: Array<[number, number, number]> = [];
  const N = 560, g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    if (z > 0.05) pts.push([x, y, z]);
  }
  return pts;
})();

const hhmm = (d: Date | null) => (d ? new Intl.DateTimeFormat('de-DE', { timeZone: DUBAI.tz, hour: '2-digit', minute: '2-digit' }).format(d) : '—');
const dayTime = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('de-DE', { timeZone: DUBAI.tz, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day}.${p.month}. ${p.hour}:${p.minute}`;
};
const inDays = (d: Date, now: Date) => { const h = (d.getTime() - now.getTime()) / 3_600_000; return h < 24 ? `in ${Math.max(1, Math.round(h))} Std.` : `in ${Math.round(h / 24)} T`; };

/** Der Kern als Mond: Phase und Schräglage wie gerade über Dubai, Richtungsmarke am äußeren Ring. */
export function MoonCore({ size, initialNow }: { size: number; initialNow: number }) {
  const { m } = useMoon(initialNow);
  const [sx, sy, sz] = sunVector(m);
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  // Richtungsmarke: Norden oben, Osten rechts (Kompass)
  const az = (m.azimuthDeg - 90) * (Math.PI / 180);
  const mx = 100 + Math.cos(az) * 95, my = 100 + Math.sin(az) * 95;
  const label = `Mond über Dubai: ${m.name}, ${Math.round(m.fraction * 100)} % beleuchtet, ${m.above ? `${Math.round(m.altitudeDeg)}° über dem Horizont Richtung ${m.direction}` : 'unter dem Horizont'}`;

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={label} className="max-w-full">
      <title>{label}</title>
      <defs>
        <radialGradient id="moon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3fd2ff" stopOpacity={0.12 + 0.25 * m.fraction} />
          <stop offset="60%" stopColor="#0b4a6e" stopOpacity=".2" />
          <stop offset="100%" stopColor="#03080e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moon-body" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#0f3c58" stopOpacity=".7" />
          <stop offset="100%" stopColor="#03111b" stopOpacity=".5" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#moon-glow)" />
      <g className="spin-slow">
        {ticks.map((i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          const red = (i > 6 && i < 13) || (i > 42 && i < 48);
          const r1 = 90, r2 = i % 6 === 0 ? 84 : 87;
          return <line key={i} x1={100 + Math.cos(a) * r1} y1={100 + Math.sin(a) * r1} x2={100 + Math.cos(a) * r2} y2={100 + Math.sin(a) * r2}
            stroke={red ? '#ff5d6e' : '#3fd2ff'} strokeOpacity={red ? 0.9 : 0.55} strokeWidth={red ? 1.6 : 0.8} />;
        })}
      </g>
      <g className="spin-mid"><circle cx="100" cy="100" r="78" fill="none" stroke="#3fd2ff" strokeOpacity=".5" strokeWidth=".7" strokeDasharray="30 6 2 6" /></g>
      <g className="spin-fast">
        <circle cx="100" cy="100" r="70" fill="none" stroke="#8fe6ff" strokeOpacity=".35" strokeWidth="1.4" strokeDasharray="1 3" />
        <path d="M100 30 A70 70 0 0 1 166 78" fill="none" stroke="#3fd2ff" strokeWidth="1.6" strokeOpacity=".9" />
      </g>
      <circle cx="100" cy="100" r="62" fill="none" stroke="#3fd2ff" strokeOpacity=".2" strokeWidth=".5" />
      {/* Kompass-Buchstaben + Mondrichtung */}
      {(['N', 'O', 'S', 'W'] as const).map((c, i) => {
        const a = (i * 90 - 90) * (Math.PI / 180);
        return <text key={c} x={100 + Math.cos(a) * 81} y={100 + Math.sin(a) * 81 + 2} textAnchor="middle" fontSize="5" fill="#7f9db1" fontFamily="ui-monospace, monospace">{c}</text>;
      })}
      <circle cx={mx} cy={my} r="3" fill={m.above ? '#e8f8ff' : '#2a4a5e'} stroke="#3fd2ff" strokeWidth=".6" className={m.above ? 'pulse' : undefined} />

      <circle cx="100" cy="100" r="56" fill="url(#moon-body)" />
      <g>
        {DOTS.map(([x, y, z], i) => {
          const d = x * sx + y * sy + z * sz;
          const lit = Math.max(0, Math.min(1, d * 6 + 0.5));
          const op = 0.06 + lit * (0.35 + 0.6 * z);
          return <circle key={i} cx={(100 + x * 52).toFixed(2)} cy={(100 + y * 52).toFixed(2)} r={(0.5 + z * 0.8).toFixed(2)}
            fill={lit > 0.5 ? '#dff6ff' : '#3fd2ff'} fillOpacity={op.toFixed(2)} />;
        })}
      </g>
    </svg>
  );
}

/** Mondzeiten für Dubai in Echtzeit */
export function MoonFacts({ initialNow }: { initialNow: number }) {
  const { now, m } = useMoon(initialNow);
  const fullFirst = m.nextFull < m.nextNew;
  const sky = m.above
    ? `am Himmel · ${Math.round(m.altitudeDeg)}° hoch · Richtung ${m.direction}`
    : `unter dem Horizont · Aufgang ${m.nextRise ? `${hhmm(m.nextRise)}${m.nextRise.getTime() - now.getTime() > 12 * 3_600_000 ? ' (morgen)' : ''}` : '—'}`;
  return (
    <section aria-label="Mond über Dubai" className="border-y border-line/70 py-2">
      <p className="mono mb-1.5 text-center text-[.62rem] uppercase tracking-[.2em] text-muted">
        <span className="mr-1 text-base not-italic">{m.emoji}</span> Mond über Dubai · <span className="text-ink">{m.name}</span> · {Math.round(m.fraction * 100)} % · {m.waxing ? 'zunehmend' : 'abnehmend'}
      </p>
      <dl className="mono grid grid-cols-2 gap-x-3 gap-y-1 text-[.64rem] uppercase tracking-wider sm:grid-cols-4">
        <Fact label="Aufgang heute" value={hhmm(m.riseToday)} />
        <Fact label="Untergang heute" value={hhmm(m.setToday)} />
        <Fact label={fullFirst ? 'Vollmond 🌕' : 'Neumond 🌑'} value={dayTime(fullFirst ? m.nextFull : m.nextNew)} sub={inDays(fullFirst ? m.nextFull : m.nextNew, now)} />
        <Fact label={fullFirst ? 'Neumond 🌑' : 'Vollmond 🌕'} value={dayTime(fullFirst ? m.nextNew : m.nextFull)} sub={inDays(fullFirst ? m.nextNew : m.nextFull, now)} />
      </dl>
      <p className={`mono mt-1.5 text-center text-[.62rem] uppercase tracking-widest ${m.above ? 'text-good' : 'text-muted'}`}>
        ● Jetzt {sky}
      </p>
    </section>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <dt className="text-muted">{label}</dt>
      <dd className="hud-num whitespace-nowrap text-[.74rem] normal-case text-sea" suppressHydrationWarning>{value}</dd>
      {sub && <dd className="text-[.58rem] normal-case text-muted" suppressHydrationWarning>{sub}</dd>}
    </div>
  );
}
