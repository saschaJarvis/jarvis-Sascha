'use client';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { toggleDoneAction } from '@/app/(app)/aufgaben/actions';

import type { CalItem } from '@/lib/calendar';
export type { CalItem };
export interface CalDay { key: number; wd: string; wdLong: string; date: string; isToday: boolean; isPast: boolean; holiday: { name: string; scope: string; emoji: string } | null;
  observances: Array<{ name: string; note: string | null; kind: 'season' | 'tradition' | 'clock'; emoji: string }>; items: CalItem[] }
export interface CalWeek { offset: number; label: string; days: CalDay[] }

/** Wochenkalender mit Reitern Mo–So; Pfeile blättern zwischen den Wochen (ohne Neuladen). */
export function WeekCalendar({ weeks, domainLabel, hasSources = true }: { weeks: CalWeek[]; domainLabel: Record<string, string>; hasSources?: boolean }) {
  const startIdx = Math.max(0, weeks.findIndex((w) => w.offset === 0));
  const [wi, setWi] = useState(startIdx);
  const week = weeks[wi];
  const todayIdx = week.days.findIndex((d) => d.isToday);
  const [di, setDi] = useState(todayIdx >= 0 ? todayIdx : 0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const day = week.days[di];

  const goWeek = (n: number) => {
    const next = Math.min(weeks.length - 1, Math.max(0, wi + n));
    setWi(next);
    const t = weeks[next].days.findIndex((d) => d.isToday);
    setDi(t >= 0 ? t : 0);
  };
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? 6 : -1;
    if (n < 0 || n > 6) return;
    e.preventDefault();
    setDi(n);
    tabs.current[n]?.focus();
  };

  return (
    <section aria-label="Wochenkalender" className="card grid gap-3">
      <header className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => goWeek(-1)} disabled={wi === 0} className="btn btn-secondary min-h-9 px-3 text-[.7rem]" aria-label="Vorige Woche">‹</button>
        <div className="text-center">
          <p className="eyebrow">{week.offset === 0 ? 'Diese Woche' : week.offset === 1 ? 'Nächste Woche' : week.offset === -1 ? 'Letzte Woche' : `In ${week.offset} Wochen`}</p>
          <p className="mono text-[.68rem] uppercase tracking-widest text-muted">{week.label}</p>
        </div>
        <button type="button" onClick={() => goWeek(1)} disabled={wi === weeks.length - 1} className="btn btn-secondary min-h-9 px-3 text-[.7rem]" aria-label="Nächste Woche">›</button>
      </header>

      <div role="tablist" aria-label="Wochentage" className="grid grid-cols-7 gap-1">
        {week.days.map((d, i) => {
          const sel = i === di;
          const hasOverdue = d.items.some((x) => x.overdue);
          return (
            <button key={d.key} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`tab-${d.key}`}
              aria-selected={sel} aria-controls={`panel-${d.key}`} tabIndex={sel ? 0 : -1}
              onClick={() => setDi(i)} onKeyDown={(e) => onKey(e, i)}
              className={`relative flex min-w-0 flex-col items-center gap-0.5 border px-0.5 py-2 transition ${
                sel ? 'border-sea bg-sea-soft text-sea shadow-[0_0_14px_rgba(63,210,255,.25)]'
                  : d.isToday ? 'border-sea/50 text-ink' : 'border-line text-muted hover:border-sea/40'} ${d.isPast && !sel ? 'opacity-60' : ''}`}>
              <span className="mono text-[.7rem] font-semibold uppercase tracking-wider">{d.wd}</span>
              <span className="hud-num text-[.62rem]">{d.date.slice(0, 5)}</span>
              <span className={`mono mt-0.5 min-w-5 px-1 text-[.6rem] ${d.items.some((x) => !x.done) ? (hasOverdue ? 'bg-bad/20 text-bad' : 'bg-sea/15 text-sea') : 'text-muted/50'}`}>
                {d.items.filter((x) => !x.done).length || (d.items.length ? '✓' : '·')}
              </span>
              {d.isToday && <span className="absolute -top-px left-1/2 h-0.5 w-6 -translate-x-1/2 bg-sea" aria-hidden="true" />}
              {(d.holiday || d.observances.length > 0) && (
                <span className="pointer-events-none absolute -right-1 -top-2 flex text-[.8rem] leading-none drop-shadow-[0_0_4px_rgba(0,0,0,.9)]"
                  title={[d.holiday?.name, ...d.observances.map((o) => o.name)].filter(Boolean).join(', ')}
                  aria-label={[d.holiday ? `Feiertag: ${d.holiday.name}` : null, ...d.observances.map((o) => o.name)].filter(Boolean).join(', ')}>
                  {[d.holiday?.emoji, ...d.observances.map((o) => o.emoji)].filter(Boolean).slice(0, 2).join('')}
                </span>
              )}
              {d.holiday && <span className="mono text-[.55rem] font-bold uppercase text-warn" aria-hidden="true">FT</span>}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${day.key}`} aria-labelledby={`tab-${day.key}`} className="min-h-28">
        <p className="mb-2 text-[1.05rem] font-semibold">{day.isToday ? 'Heute, ' : ''}{day.wdLong}, {day.date}</p>
        {day.holiday && (
          <p className="mb-2 flex flex-wrap items-baseline gap-x-2 border-l-2 border-warn bg-warn-soft px-3 py-2">
            <span className="font-semibold text-warn"><span className="mr-1 text-lg">{day.holiday.emoji}</span>{day.holiday.name}</span>
            <span className="mono text-[.6rem] uppercase tracking-wider text-muted">{day.holiday.scope === 'bundesweit' ? 'Feiertag in ganz Deutschland · Ämter, Banken, Post geschlossen' : 'Feiertag in Rheinland-Pfalz · Ämter in Mainz/RLP geschlossen'}</span>
          </p>
        )}
        {day.observances.map((o) => (
          <p key={o.name} className="mb-2 flex flex-wrap items-baseline gap-x-2 border-l-2 border-sea/60 bg-sea-soft/40 px-3 py-1.5">
            <span className="font-semibold"><span className="mr-1 text-lg">{o.emoji}</span>{o.name}</span>
            {o.note && <span className="mono text-[.6rem] uppercase tracking-wider text-muted">{o.note}</span>}
          </p>
        ))}
        {day.items.length ? (
          <ol className="grid gap-1.5">
            {day.items.map((t) => (
              <li key={t.id}>
                {t.kind === 'event' ? (
                  <div className="flex items-start gap-3 border-l-2 border-good bg-good-soft/30 px-3 py-2">
                    <span className="mono w-14 shrink-0 pt-0.5 text-[.72rem] text-good">{t.time ?? 'ganzt.'}{t.endTime && <span className="block text-[.62rem] text-muted">– {t.endTime}</span>}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block leading-snug">{t.title}</span>
                      <span className="mono text-[.6rem] uppercase tracking-wider text-muted">◷ {t.source ?? 'Kalender'}{t.location ? ` · ${t.location}` : ''}</span>
                    </span>
                  </div>
                ) : (
                  <div className={`flex items-stretch border-l-2 bg-card/40 ${t.done ? 'border-good/60 opacity-70' : t.overdue ? 'border-bad' : t.hard ? 'border-warn' : 'border-sea'}`}>
                    <CheckBox id={t.id} version={t.version} done={!!t.done} title={t.title} />
                    <Link href={`/aufgaben/${t.id}`} className="flex min-w-0 flex-1 items-start gap-3 py-2 pr-3 hover:bg-sea-soft/40">
                      <span className={`mono w-12 shrink-0 pt-0.5 text-[.72rem] ${t.done ? 'text-muted' : t.overdue ? 'text-bad' : 'text-sea'}`}>{t.time ?? 'ganzt.'}</span>
                      <span className="min-w-0 flex-1">
                        <span className={`block leading-snug ${t.done ? 'text-muted line-through' : ''}`}>{t.title}</span>
                        <span className="mono text-[.6rem] uppercase tracking-wider text-muted">
                          {t.done ? '✓ erledigt' : <>▪ Aufgabe · {domainLabel[t.domain] ?? t.domain}{t.hard ? ' · feste Frist' : ''}{t.overdue ? ' · überfällig' : ''}</>}
                        </span>
                      </span>
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="border border-dashed border-line px-3 py-5 text-center text-sm text-muted">
            {day.isPast ? 'Nichts offen an diesem Tag.' : 'Frei – keine Termine oder Fristen.'}
          </p>
        )}
        <div className="mt-2 flex flex-wrap justify-between gap-2">
          <Link href="/aufgaben/neu" className="btn-quiet inline-flex">+ Aufgabe anlegen</Link>
          {!hasSources && <Link href="/kalender?verbinden=1" className="btn-quiet inline-flex">◷ iPhone-Kalender verbinden</Link>}
        </div>
      </div>
    </section>
  );
}

/** Abhak-Kästchen: Tippen = erledigt, nochmal tippen = wieder offen. */
function CheckBox({ id, version, done, title }: { id: string; version?: number; done: boolean; title: string }) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useState(done);
  const [err, setErr] = useState<string | null>(null);
  if (version == null) return <span className="w-3" />;
  return (
    <button type="button" disabled={pending}
      aria-pressed={optimistic} aria-label={optimistic ? `„${title}“ wieder öffnen` : `„${title}“ abhaken`} title={err ?? undefined}
      onClick={() => {
        const next = !optimistic;
        setOptimistic(next); setErr(null);
        start(async () => {
          const r = await toggleDoneAction(id, version, next);
          if (r.error) { setOptimistic(!next); setErr(r.error); }
        });
      }}
      className="flex w-11 shrink-0 items-center justify-center">
      <span className={`flex h-5 w-5 items-center justify-center border text-[.8rem] transition ${optimistic ? 'border-good bg-good/20 text-good' : err ? 'border-bad' : 'border-sea/70 hover:bg-sea-soft'} ${pending ? 'pulse' : ''}`}>
        {optimistic ? '✓' : ''}
      </span>
    </button>
  );
}
