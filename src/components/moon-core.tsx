'use client';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { SkySphere } from './sky-sphere';
import { DUBAI, limbRotationDeg, litPath, moonState, sunState, sunVector, type MoonState, type SunState } from '@/lib/moon';

/** Aktualisiert jede Minute; startet mit der Serverzeit, damit Server- und Browserbild identisch sind. */
function useSky(initialNow: number): { now: Date; m: MoonState; s: SunState } {
  const [now, setNow] = useState(() => new Date(initialNow));
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const minute = Math.floor(now.getTime() / 60_000);
  const m = useMemo(() => moonState(new Date(minute * 60_000), DUBAI), [minute]);
  const s = useMemo(() => sunState(new Date(minute * 60_000), DUBAI), [minute]);
  return { now, m, s };
}

const hhmm = (d: Date | null) => (d ? new Intl.DateTimeFormat('de-DE', { timeZone: DUBAI.tz, hour: '2-digit', minute: '2-digit' }).format(d) : '—');
const dayTime = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('de-DE', { timeZone: DUBAI.tz, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day}.${p.month}. ${p.hour}:${p.minute}`;
};
const inDays = (d: Date, now: Date) => { const h = (d.getTime() - now.getTime()) / 3_600_000; return h < 24 ? `in ${Math.max(1, Math.round(h))} Std.` : `in ${Math.round(h / 24)} T`; };

// Mondoberfläche (frei gestaltet): dunkle „Meere“ und Krater, Koordinaten in Mondradien
const MARIA: Array<[number, number, number, number, number]> = [
  // cx, cy, rx, ry, Drehung
  [-0.28, -0.32, 0.26, 0.2, -20], [0.12, -0.38, 0.2, 0.16, 15], [0.3, -0.08, 0.18, 0.22, 0], [-0.42, 0.05, 0.2, 0.3, 10],
  [0.05, 0.05, 0.16, 0.12, 30], [-0.1, 0.3, 0.22, 0.14, -10], [0.38, 0.32, 0.12, 0.1, 0], [0.55, -0.35, 0.1, 0.08, 0],
];
const CRATERS: Array<[number, number, number]> = [
  [-0.18, 0.62, 0.07], [0.42, 0.55, 0.05], [-0.6, -0.42, 0.05], [0.66, 0.1, 0.045], [-0.02, -0.66, 0.04], [-0.7, 0.32, 0.04],
  [0.2, 0.75, 0.035], [-0.38, 0.72, 0.03], [0.6, -0.6, 0.03], [0.15, 0.4, 0.03], [-0.5, -0.7, 0.025], [0.75, 0.4, 0.025],
];

function Ring({ s, m, showSun }: { s: SunState; m: MoonState; showSun: boolean }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  const mark = (azDeg: number) => { const a = (azDeg - 90) * (Math.PI / 180); return [100 + Math.cos(a) * 95, 100 + Math.sin(a) * 95]; };
  const [sx, sy] = mark(s.azimuthDeg), [mx, my] = mark(m.azimuthDeg);
  const accent = showSun ? '#ffb547' : '#3fd2ff';
  return (
    <>
      <g className="spin-slow">
        {ticks.map((i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          const red = (i > 6 && i < 13) || (i > 42 && i < 48);
          const r1 = 90, r2 = i % 6 === 0 ? 84 : 87;
          return <line key={i} x1={100 + Math.cos(a) * r1} y1={100 + Math.sin(a) * r1} x2={100 + Math.cos(a) * r2} y2={100 + Math.sin(a) * r2}
            stroke={red ? '#ff5d6e' : accent} strokeOpacity={red ? 0.9 : 0.55} strokeWidth={red ? 1.6 : 0.8} />;
        })}
      </g>
      <g className="spin-mid"><circle cx="100" cy="100" r="78" fill="none" stroke={accent} strokeOpacity=".45" strokeWidth=".7" strokeDasharray="30 6 2 6" /></g>
      <g className="spin-fast">
        <circle cx="100" cy="100" r="70" fill="none" stroke={showSun ? '#ffd27a' : '#8fe6ff'} strokeOpacity=".3" strokeWidth="1.4" strokeDasharray="1 3" />
        <path d="M100 30 A70 70 0 0 1 166 78" fill="none" stroke={accent} strokeWidth="1.6" strokeOpacity=".9" />
      </g>
      {(['N', 'O', 'S', 'W'] as const).map((c, i) => {
        const a = (i * 90 - 90) * (Math.PI / 180);
        return <text key={c} x={100 + Math.cos(a) * 81} y={100 + Math.sin(a) * 81 + 2} textAnchor="middle" fontSize="5" fill="#7f9db1" fontFamily="ui-monospace, monospace">{c}</text>;
      })}
      {/* Richtungsmarken: Sonne (gelb) und Mond (hell); gefüllt = über dem Horizont */}
      <circle cx={sx} cy={sy} r="3" fill={s.up ? '#ffc94a' : 'none'} stroke="#ffb547" strokeWidth=".7" opacity={s.up ? 1 : 0.5} />
      <circle cx={mx} cy={my} r="2.6" fill={m.above ? '#e8f4fa' : 'none'} stroke="#b9d3e0" strokeWidth=".7" opacity={m.above ? 1 : 0.5} />
    </>
  );
}

function Sun({ s, id, body }: { s: SunState; id: string; body: boolean }) {
  // Nahe am Horizont rötlicher (Morgen-/Abendsonne)
  const low = Math.max(0, Math.min(1, (12 - s.altitudeDeg) / 12));
  const core = low > 0.5 ? '#ffe2b0' : '#fffbe8';
  const mid = low > 0.5 ? '#ff9a3c' : '#ffd23f';
  const edge = low > 0.5 ? '#e8572b' : '#ff9f1c';
  const rays = Array.from({ length: 24 }, (_, i) => i);
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-disk`} cx="45%" cy="42%" r="60%"><stop offset="0%" stopColor={core} /><stop offset="55%" stopColor={mid} /><stop offset="100%" stopColor={edge} /></radialGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={mid} stopOpacity=".55" /><stop offset="60%" stopColor={edge} stopOpacity=".12" /><stop offset="100%" stopColor="#03080e" stopOpacity="0" /></radialGradient>
      </defs>
      <circle cx="100" cy="100" r="66" fill={`url(#${id}-glow)`} className="pulse" />
      <g className="spin-slow" opacity=".85">
        {rays.map((i) => {
          const a = (i / rays.length) * Math.PI * 2, long = i % 2 === 0;
          const r1 = 47, r2 = long ? 62 : 55, w = long ? 2.4 : 1.6;
          const p = (r: number, da = 0) => `${(100 + Math.cos(a + da) * r).toFixed(2)},${(100 + Math.sin(a + da) * r).toFixed(2)}`;
          return <polygon key={i} points={`${p(r1, -w / r1)} ${p(r2)} ${p(r1, w / r1)}`} fill={mid} fillOpacity={long ? 0.75 : 0.5} />;
        })}
      </g>
      {body && <circle cx="100" cy="100" r="44" fill={`url(#${id}-disk)`} />}
      {body && <circle cx="100" cy="100" r="44" fill="none" stroke="#fff3c4" strokeOpacity=".5" strokeWidth=".6" />}
    </g>
  );
}

function Moon({ m, id, body }: { m: MoonState; id: string; body: boolean }) {
  const R = 50;
  const rot = limbRotationDeg(m.brightLimbFromZenith);
  const lit = litPath(m.fraction, R);
  const surface = (
    <g>
      <circle r={R} fill={`url(#${id}-moon-surface)`} />
      {MARIA.map(([cx, cy, rx, ry, a], i) => <ellipse key={i} cx={cx * R} cy={cy * R} rx={rx * R} ry={ry * R} transform={`rotate(${a} ${cx * R} ${cy * R})`} fill="#8a9aa6" fillOpacity=".45" filter={`url(#${id}-soft)`} />)}
      {CRATERS.map(([cx, cy, r], i) => (
        <g key={i}><circle cx={cx * R} cy={cy * R} r={r * R} fill="#9fb0bb" fillOpacity=".55" /><circle cx={cx * R - r * R * 0.25} cy={cy * R - r * R * 0.25} r={r * R * 0.7} fill="#e9f1f5" fillOpacity=".35" /></g>
      ))}
    </g>
  );
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-moon-surface`} cx="42%" cy="40%" r="65%"><stop offset="0%" stopColor="#f4f8fa" /><stop offset="70%" stopColor="#d3dde3" /><stop offset="100%" stopColor="#aebcc5" /></radialGradient>
        <radialGradient id={`${id}-moon-halo`} cx="50%" cy="50%" r="50%"><stop offset="55%" stopColor="#bfe8ff" stopOpacity={0.08 + 0.3 * m.fraction} /><stop offset="100%" stopColor="#03080e" stopOpacity="0" /></radialGradient>
        <filter id={`${id}-soft`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.6" /></filter>
        <filter id={`${id}-terminator`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.1" /></filter>
        <clipPath id={`${id}-moon-disk`}><circle r={R} /></clipPath>
        <mask id={`${id}-moon-lit`}><rect x={-R - 2} y={-R - 2} width={2 * R + 4} height={2 * R + 4} fill="black" />{lit && <path d={lit} fill="white" filter={`url(#${id}-terminator)`} transform={`rotate(${rot.toFixed(2)})`} />}</mask>
      </defs>
      <circle cx="100" cy="100" r="68" fill={`url(#${id}-moon-halo)`} />
      {body && (
        <g transform="translate(100 100)" clipPath={`url(#${id}-moon-disk)`}>
          {/* Nachtseite: schwach sichtbar (Erdschein) */}
          <g opacity=".1">{surface}</g>
          <g mask={`url(#${id}-moon-lit)`}>{surface}</g>
        </g>
      )}
      <circle cx="100" cy="100" r={R} fill="none" stroke="#bfe8ff" strokeOpacity=".2" strokeWidth=".5" />
    </g>
  );
}

/** Der Kern: tagsüber die Sonne, nachts der Mond mit echter Phase und Schräglage über Dubai. */
export function MoonCore({ initialNow, className = '' }: { initialNow: number; className?: string }) {
  const { m, s } = useSky(initialNow);
  const uid = `sky${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [gl, setGl] = useState<boolean | null>(null); // null = noch nicht geprüft → SVG zeigen
  const onReady = useCallback((ok: boolean) => setGl(ok), []);
  const showSun = s.up;
  const low = Math.max(0, Math.min(1, (12 - s.altitudeDeg) / 12));
  const label = showSun
    ? `Sonne über Dubai: ${Math.round(s.altitudeDeg)}° hoch, Richtung ${s.direction}, Untergang ${hhmm(s.sunset)}`
    : `Mond über Dubai: ${m.name}, ${Math.round(m.fraction * 100)} % beleuchtet, ${m.above ? `${Math.round(m.altitudeDeg)}° hoch Richtung ${m.direction}` : 'unter dem Horizont'}`;
  const body = gl !== true;
  const pct = showSun ? 44 : 50; // Durchmesser der Kugel in % der Kachel
  return (
    <div className={`relative aspect-square max-w-full ${className}`} role="img" aria-label={label} title={label}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="100" cy="100" r="62" fill="none" stroke={showSun ? '#ffb547' : '#3fd2ff'} strokeOpacity=".2" strokeWidth=".5" />
        {showSun ? <Sun s={s} id={uid} body={body} /> : <Moon m={m} id={uid} body={body} />}
        <Ring s={s} m={m} showSun={showSun} />
      </svg>
      {gl !== false && (
        <SkySphere mode={showSun ? 'sun' : 'moon'} sunDir={sunVector(m)} low={low} onReady={onReady}
          className={`absolute transition-opacity duration-700 ${gl ? 'opacity-100' : 'opacity-0'}`}
          style={{ left: `${(100 - pct) / 2}%`, top: `${(100 - pct) / 2}%`, width: `${pct}%`, height: `${pct}%` }} />
      )}
    </div>
  );
}

/** Sonnen- und Mondzeiten für Dubai in Echtzeit */
export function MoonFacts({ initialNow }: { initialNow: number }) {
  const { now, m, s } = useSky(initialNow);
  const fullFirst = m.nextFull < m.nextNew;
  const headline = s.up
    ? <>☀️ Sonne über Dubai · <span className="text-warn">{Math.round(s.altitudeDeg)}° hoch</span> · Richtung {s.direction} · Untergang {hhmm(s.nextSunset)}</>
    : <>{m.emoji} Mond über Dubai · <span className="text-ink">{m.name}</span> · {Math.round(m.fraction * 100)} % · {m.above ? `${Math.round(m.altitudeDeg)}° hoch · ${m.direction}` : `unter dem Horizont · Aufgang ${hhmm(m.nextRise)}`}</>;
  const dl = `${Math.floor(s.dayLengthMin / 60)} Std. ${s.dayLengthMin % 60} Min.`;
  return (
    <section aria-label="Sonne und Mond über Dubai" className="border-y border-line/70 py-2">
      <p className="mono mb-2 text-center text-[.62rem] uppercase tracking-[.18em] text-muted" suppressHydrationWarning>{headline}</p>
      <dl className="mono grid grid-cols-2 gap-x-3 gap-y-1.5 text-[.62rem] uppercase tracking-wider sm:grid-cols-3">
        <Fact label="🌅 Sonnenaufgang" value={hhmm(s.sunrise)} />
        <Fact label="🌇 Sonnenuntergang" value={hhmm(s.sunset)} sub={`Tag: ${dl}`} />
        <Fact label={`${m.emoji} Mond · ${Math.round(m.fraction * 100)} %`} value={m.name} sub={m.waxing ? 'zunehmend' : 'abnehmend'} />
        <Fact label="🌙 Mondaufgang" value={hhmm(m.riseToday)} sub="heute" />
        <Fact label="Monduntergang" value={hhmm(m.setToday)} sub="heute" />
        <Fact label={fullFirst ? '🌕 Vollmond' : '🌑 Neumond'} value={dayTime(fullFirst ? m.nextFull : m.nextNew)} sub={inDays(fullFirst ? m.nextFull : m.nextNew, now)} />
      </dl>
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
