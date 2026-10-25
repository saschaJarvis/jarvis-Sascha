import Link from 'next/link';

/** Nummeriertes HUD-Panel: „01 HEUTE“ links, optional Zusatz rechts. */
export function Panel({ n, title, aside, href, children, className = '' }:
  { n: string; title: string; aside?: React.ReactNode; href?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card flex min-w-0 flex-col gap-3 ${className}`} aria-label={title}>
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2">
          <span className="hud-tag">{n}</span>
          {href ? <Link href={href} className="eyebrow hover:underline">{title}</Link> : <span className="eyebrow">{title}</span>}
        </h2>
        {aside && <div className="mono text-[.7rem] uppercase tracking-widest text-muted">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

/** Kennzahl im Kachel-Stil */
export function Metric({ label, value, sub, tone = 'ink', href }:
  { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'ink' | 'sea' | 'warn' | 'bad' | 'good' | 'muted'; href?: string }) {
  const color = { ink: 'text-ink', sea: 'text-sea glow', warn: 'text-warn', bad: 'text-bad', good: 'text-good', muted: 'text-muted' }[tone];
  const body = (
    <>
      <p className="mono text-[.65rem] uppercase tracking-[.18em] text-muted">{label}</p>
      <p className={`hud-num text-2xl font-semibold leading-tight ${color}`}>{value}</p>
      {sub && <p className="mono text-[.68rem] text-muted">{sub}</p>}
    </>
  );
  return href
    ? <Link href={href} className="block border-l border-line pl-3 hover:border-sea">{body}</Link>
    : <div className="border-l border-line pl-3">{body}</div>;
}

/** Leerer Zustand: ehrlich sagen, was fehlt – keine Platzhalterzahlen. */
export function Empty({ children, action }: { children: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="grid gap-2 border border-dashed border-line px-3 py-4 text-center">
      <p className="mono text-xs uppercase tracking-widest text-muted">{children}</p>
      {action && <Link href={action.href} className="btn-quiet mx-auto">{action.label} ›</Link>}
    </div>
  );
}

/** Kleine Fortschrittsleiste in Segmenten */
export function Segments({ value, total, tone = 'sea' }: { value: number; total: number; tone?: 'sea' | 'warn' | 'good' }) {
  const n = Math.max(1, Math.min(24, total));
  const filled = total ? Math.round((value / total) * n) : 0;
  const on = { sea: 'bg-sea shadow-[0_0_6px_rgba(63,210,255,.6)]', warn: 'bg-warn', good: 'bg-good' }[tone];
  return (
    <div className="flex gap-[3px]" role="img" aria-label={`${value} von ${total}`}>
      {Array.from({ length: n }, (_, i) => <span key={i} className={`h-2 flex-1 ${i < filled ? on : 'bg-line'}`} />)}
    </div>
  );
}

// Punktwolke für den Kern: Fibonacci-Kugel, deterministisch (gleiches Bild auf Server und Client)
const DOTS = (() => {
  const pts: Array<{ x: number; y: number; r: number; o: number }> = [];
  const N = 420;
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = g * i;
    const x = Math.cos(th) * rad;
    const z = Math.sin(th) * rad;
    if (z < -0.15) continue; // Rückseite ausblenden
    pts.push({ x: 100 + x * 52, y: 100 + y * 52, r: 0.55 + z * 0.75, o: 0.25 + z * 0.65 });
  }
  return pts;
})();

/** Der leuchtende Kern in der Mitte – rein dekorativ, respektiert „Bewegung reduzieren“. */
export function Core({ size = 280, label }: { size?: number; label?: string }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={label ?? 'Jarvis-Kern'} className="max-w-full">
      <defs>
        <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3fd2ff" stopOpacity=".35" />
          <stop offset="55%" stopColor="#0b4a6e" stopOpacity=".25" />
          <stop offset="100%" stopColor="#03080e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="core-sphere" cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#1d6f98" stopOpacity=".55" />
          <stop offset="70%" stopColor="#06263a" stopOpacity=".5" />
          <stop offset="100%" stopColor="#03111b" stopOpacity=".2" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#core-glow)" />
      {/* äußerer Tick-Ring mit roten Segmenten */}
      <g className="spin-slow">
        {ticks.map((i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          const red = (i > 6 && i < 13) || (i > 42 && i < 48);
          const r1 = 90, r2 = i % 6 === 0 ? 84 : 87;
          return <line key={i} x1={100 + Math.cos(a) * r1} y1={100 + Math.sin(a) * r1} x2={100 + Math.cos(a) * r2} y2={100 + Math.sin(a) * r2}
            stroke={red ? '#ff5d6e' : '#3fd2ff'} strokeOpacity={red ? 0.9 : 0.55} strokeWidth={red ? 1.6 : 0.8} />;
        })}
      </g>
      <g className="spin-mid">
        <circle cx="100" cy="100" r="78" fill="none" stroke="#3fd2ff" strokeOpacity=".5" strokeWidth=".7" strokeDasharray="30 6 2 6" />
      </g>
      <g className="spin-fast">
        <circle cx="100" cy="100" r="70" fill="none" stroke="#8fe6ff" strokeOpacity=".35" strokeWidth="1.4" strokeDasharray="1 3" />
        <path d="M100 30 A70 70 0 0 1 166 78" fill="none" stroke="#3fd2ff" strokeWidth="1.6" strokeOpacity=".9" />
      </g>
      <circle cx="100" cy="100" r="62" fill="none" stroke="#3fd2ff" strokeOpacity=".2" strokeWidth=".5" />
      <circle cx="100" cy="100" r="55" fill="url(#core-sphere)" className="pulse" />
      <g>
        {DOTS.map((d, i) => <circle key={i} cx={d.x.toFixed(2)} cy={d.y.toFixed(2)} r={d.r.toFixed(2)} fill="#8fe6ff" fillOpacity={d.o.toFixed(2)} />)}
      </g>
    </svg>
  );
}
