import Link from 'next/link';
import { requireUser } from '@/server/auth';
import { db, asPriorityTask, TaskRow } from '@/server/repo';
import { getFx, getWeather } from '@/server/ext';
import { buildTodayView, scoreTask } from '@/lib/domain/priority';
import { primaryActionFor } from '@/lib/domain/taskStateMachine';
import { CANCELLATION_STEPS_DE } from '@/lib/domain/cancellationStateMachine';
import { checkLtv, ltvStage, STAGE_LABEL } from '@/lib/domain/property';
import { Certainty, formatDue } from '@/components/ui';
import { Empty, Metric, Panel, Segments } from '@/components/hud';
import { MoonCore, MoonFacts } from '@/components/moon-core';
import { TransitionButton } from '@/components/task-actions';
import { SnoozeMenu } from '@/components/snooze';
import { QuickCapture } from '@/components/quick-capture';
import { SortUpload } from '@/components/sort-upload';
import { WeekCalendar } from '@/components/week-calendar';
import { buildCalendar, eventsOnDay } from '@/lib/calendar';
import { holidaysBetween } from '@/lib/holidays';
import { observancesBetween } from '@/lib/special-days';
import { loadExternalEvents } from '@/server/calendars';
import { ensureBillTasks } from '@/server/bills';
import { DOMAIN_LABEL as DOMAIN } from '@/lib/labels';
import { claudeAvailable, AI_CONSENT } from '@/server/claude';

const DUBAI_DOCS = 6; // je nach Status: SPA, Oqood/Title Deed, Zahlungsplan/-nachweise, Bankangebot, Service Charge, Übergabe

interface Stats {
  contracts: number; contracts_demo: number; accounts: number; transactions: number; documents: number; uae_docs: number;
  chain_broken_at: string | null; review: number; ai_consent: boolean;
}

/** Tagesnummer in der Zeitzone des Nutzers (für „heute“, „morgen“, „3 T über“) */
const dayNo = (d: Date, tz: string) => Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)) / 86_400_000;
// formatToParts statt format: de-DE liefert sonst „09 Uhr“ → NaN
const hourIn = (d: Date, tz: string) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).formatToParts(d).find((p) => p.type === 'hour')?.value ?? 0);
const hhmm = (d: Date, tz: string) => new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(d);

export default async function BridgePage() {
  const s = await requireUser();
  await ensureBillTasks(s);
  const [profile, open, done, closedCal, extra, fx, ext] = await Promise.all([
    db(s).profile(), db(s).openTasks(), db(s).recentlyDone(),
    db(s).doneInRange(new Date(Date.now() - 8 * 86_400_000), new Date(Date.now() + 9 * 7 * 86_400_000)),
    db(s).run(async (q) => {
      const [stats] = await q<Stats>(`select
        (select count(*)::int from contracts where deleted_at is null and not is_demo) contracts,
        (select count(*)::int from contracts where deleted_at is null and is_demo) contracts_demo,
        (select count(*)::int from accounts where deleted_at is null) accounts,
        (select count(*)::int from transactions) transactions,
        (select count(*)::int from documents where deleted_at is null) documents,
        (select count(*)::int from documents where deleted_at is null and folder = 'uae_property') uae_docs,
        app.verify_audit_chain(auth.uid())::text chain_broken_at,
        (select count(*)::int from tasks where deleted_at is null and status in ('DETECTED','NEEDS_REVIEW')) review,
        app.has_consent(auth.uid(), $1) ai_consent`, [AI_CONSENT]);
      const cancellations = await q<{ id: string; contract_id: string; name: string; status: string; is_demo: boolean }>(
        `select r.id, r.contract_id, c.name, r.status::text status, r.is_demo from cancellation_requests r join contracts c on c.id = r.contract_id
          where r.deleted_at is null and r.status <> 'CLOSED' order by r.updated_at desc limit 4`);
      const property = await q<{ project_name: string; location: string | null; financing_ltv_pct: string | null; stage: string | null }>(
        'select project_name, location, financing_ltv_pct, stage from properties where deleted_at is null order by created_at limit 1');
      const log = await q<{ seq: string; actor: string; action: string; created_at: Date }>(
        'select seq, actor, action, created_at from audit_events order by seq desc limit 4');
      return { stats, cancellations, property: property[0], log };
    }),
    getFx(),
    loadExternalEvents(s, new Date(Date.now() - 8 * 86_400_000), new Date(Date.now() + 9 * 7 * 86_400_000)),
  ]);
  const weather = await getWeather(profile.timezone);

  const tz = profile.timezone;
  const now = new Date();
  const today = dayNo(now, tz);
  const prio = open.map(asPriorityTask);
  const view = buildTodayView(prio, now);
  const main = view.doThisNow?.task.row;
  const action = main ? primaryActionFor(main.status, main.evidence_required) : null;

  const due = (t: TaskRow) => (t.due_at ? new Date(t.due_at) : null);
  const overdue = open.filter((t) => due(t) && due(t)! < now);
  const thisWeek = open.filter((t) => due(t) && dayNo(due(t)!, tz) - today >= 0 && dayNo(due(t)!, tz) - today < 7);
  const evidence = open.filter((t) => t.status === 'EVIDENCE_PENDING');
  const relocation = open.filter((t) => t.domain === 'relocation');
  const todayTasks = open.filter((t) => due(t) && dayNo(due(t)!, tz) === today).sort((a, b) => +due(a)! - +due(b)!);
  const ranked = prio.map((t) => scoreTask(t, now)).sort((a, b) => b.score - a.score);
  const alerts = overdue.filter((t) => t.due_is_hard || t.urgency >= 3).slice(0, 2);
  const todayEvents = eventsOnDay(ext.events, tz, today);
  const nextHoliday = holidaysBetween(today, today + 3)[0];
  const todaySpecial = observancesBetween(today, today);
  const nextEvent = todayEvents.filter((e) => !e.allDay && e.start > now).sort((a, b) => +a.start - +b.start)[0];
  const upcoming = open.filter((t) => due(t) && due(t)! >= now).sort((a, b) => +due(a)! - +due(b)!).slice(0, 5);

  const hour = hourIn(now, tz);
  const hello = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const name = profile.display_name ?? 'Sascha';
  const dateLong = new Intl.DateTimeFormat('de-DE', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const paused = profile.paused_until && new Date(profile.paused_until) > now;
  const daysToMove = profile.moving_date && profile.moving_date_certainty === 'verified'
    ? Math.ceil((Date.parse(`${profile.moving_date}T00:00:00Z`) - now.getTime()) / 86_400_000) : null;
  const ltv = extra.property?.financing_ltv_pct
    ? checkLtv({ buyer: 'expat', stage: ltvStage(extra.property.stage), use: 'first_home', valueAed: 0, plannedLtvPct: Number(extra.property.financing_ltv_pct) }) : null;

  const briefing = [
    `${hello}, ${name}. Es ist ${dateLong}, ${hhmm(now, 'Asia/Dubai')} Uhr in Dubai und ${hhmm(now, 'Europe/Berlin')} Uhr in Mainz${weather ? `, ${weather.tempC} °C in ${weather.place}` : ''}.`,
    todayEvents.length ? `Im Kalender ${todayEvents.length === 1 ? 'steht heute ein Termin' : `stehen heute ${todayEvents.length} Termine`}${nextEvent ? `, als Nächstes „${nextEvent.title}“ um ${hhmm(nextEvent.start, tz)} Uhr` : ''}.` : '',
    todayTasks.length ? `${todayTasks.length === 1 ? 'Eine Aufgabe hat' : `${todayTasks.length} Aufgaben haben`} heute eine Frist.` : todayEvents.length ? '' : 'Heute hast du keine festen Termine.',
    overdue.length ? `${overdue.length} ${overdue.length === 1 ? 'Aufgabe ist' : 'Aufgaben sind'} überfällig.` : 'Nichts ist überfällig.',
    todaySpecial.length ? `Heute: ${todaySpecial.map((o) => `${o.emoji} ${o.name}${o.note ? ` (${o.note})` : ''}`).join('; ')}.` : '',
    nextHoliday ? (nextHoliday.dn === today ? `${nextHoliday.emoji} Heute ist in Deutschland Feiertag (${nextHoliday.name}) – Ämter und Banken dort sind zu.` : `${nextHoliday.dn === today + 1 ? 'Morgen' : `Am ${new Date(nextHoliday.dn * 86_400_000).toLocaleDateString('de-DE', { weekday: 'long', timeZone: 'UTC' })}`} ist in Deutschland Feiertag (${nextHoliday.name}).`) : '',
    main ? `Mein Vorschlag für jetzt: „${main.title}“.` : 'Gerade drängt nichts – guter Moment, Dinge aus dem Kopf zu notieren.',
  ].filter(Boolean).join(' ');

  const weeks = buildCalendar([...open, ...closedCal], tz, now, 1, 8, ext.events);
  const hours = Array.from({ length: 16 }, (_, i) => i + 7); // 07–22 Uhr

  const domainCounts = Object.entries(open.reduce<Record<string, number>>((m, t) => ((m[t.domain] = (m[t.domain] ?? 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 4);

  const lateLabel = (t: TaskRow) => {
    const d = due(t);
    if (!d) return null;
    const diff = today - dayNo(d, tz);
    if (diff > 0) return <span className="text-bad">{diff} T über</span>;
    if (diff === 0) return <span className="text-warn">heute</span>;
    return <span className="text-muted">in {-diff} T</span>;
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      {paused && (
        <p className="notice notice-info">Erinnerungen pausiert bis {new Intl.DateTimeFormat('de-DE', { timeZone: tz, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(profile.paused_until!))}. <Link className="underline" href="/leben/einstellungen">Ändern</Link></p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* ───────────── MITTE: Kern ───────────── */}
        <div className="order-1 grid min-w-0 grid-cols-1 content-start gap-4 xl:order-2">
          {alerts.map((t) => (
            <Link key={t.id} href={`/aufgaben/${t.id}`} className={`flex items-center gap-3 border px-4 py-3 ${t.urgency >= 3 ? 'border-bad bg-bad-soft' : 'border-warn bg-warn-soft'}`}>
              <span aria-hidden="true" className={`text-2xl ${t.urgency >= 3 ? 'text-bad' : 'text-warn'}`}>▲</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t.title}</span>
                <span className="mono block text-[.68rem] uppercase tracking-widest text-muted">Frist {formatDue(t.due_at, tz)}{t.due_is_hard ? ' · fest' : ''}</span>
              </span>
              <span className="mono border border-current px-2 py-1 text-[.66rem] uppercase tracking-widest">Öffnen</span>
            </Link>
          ))}

          <section aria-label="Kern" className="relative">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-2">
              <div className="grid gap-8 justify-items-end text-right">
                <CoreStat label="Überfällig" value={overdue.length} sub={overdue.length ? 'jetzt angehen' : 'alles im Plan'} tone={overdue.length ? 'bad' : 'good'} href="/aufgaben" />
                <CoreStat label="Nachweise" value={evidence.length} sub="Beleg fehlt" tone={evidence.length ? 'warn' : 'muted'} href="/eingang" />
              </div>
              <div className="relative">
                <MoonCore initialNow={now.getTime()} className="w-[150px] sm:w-[300px]" />
              </div>
              <div className="grid gap-8">
                <CoreStat label="Diese Woche" value={thisWeek.length} sub="mit Frist" tone="sea" href="/aufgaben" />
                <CoreStat label="Umzug" value={relocation.length} sub={daysToMove !== null ? `${daysToMove} Tage bis Dubai` : 'Datum offen'} tone="sea" href="/leben/dubai" />
              </div>
            </div>
          </section>

          <MoonFacts initialNow={now.getTime()} />

          {main && view.doThisNow ? (
            <section aria-labelledby="jetzt" className="card border-sea/60 shadow-[0_0_30px_rgba(63,210,255,.12)]">
              <p id="jetzt" className="eyebrow text-center">▸ Nächster Schritt</p>
              <h1 className="mt-2 text-center text-[1.45rem] font-semibold leading-snug"><Link href={`/aufgaben/${main.id}`}>{main.title}</Link></h1>
              {main.next_step && <p className="mt-2 text-center text-muted">→ {main.next_step}</p>}
              <div className="mono mt-2 flex flex-wrap items-center justify-center gap-3 text-[.72rem] uppercase tracking-widest text-muted">
                {formatDue(main.due_at, tz) && <span className="text-warn">{formatDue(main.due_at, tz)}</span>}
                {main.effort_minutes && <span>ca. {main.effort_minutes} Min.</span>}
                {main.certainty !== 'verified' && <Certainty value={main.certainty} />}
              </div>
              {view.doThisNow.reasons.length > 0 && (
                <details className="mt-3 text-center text-sm">
                  <summary className="mono cursor-pointer text-[.72rem] uppercase tracking-widest text-sea">Warum steht das oben?</summary>
                  <ul className="mt-2 grid gap-0.5 text-muted">{view.doThisNow.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                </details>
              )}
              <div className="mx-auto mt-4 grid max-w-md gap-2">
                {action && <TransitionButton id={main.id} version={main.version} to={action.to} label={action.label} big />}
                <div className="flex items-center justify-between">
                  <Link href={`/aufgaben/${main.id}`} className="btn-quiet">Details</Link>
                  <Link href="/heute/ruhig" className="btn-quiet">Zu viel?</Link>
                  <SnoozeMenu id={main.id} />
                </div>
              </div>
            </section>
          ) : (
            <section className="card text-center">
              <p className="eyebrow">Status</p>
              <p className="mt-1 text-2xl font-semibold text-good">Alles im Griff.</p>
              <p className="mt-1 text-muted">Gerade steht nichts Dringendes an.</p>
            </section>
          )}

          <div className="card"><SortUpload claude={claudeAvailable()} consented={extra.stats.ai_consent} /></div>

          <section aria-label="Lagebericht" className="px-1 text-center">
            <p className="mx-auto max-w-2xl text-[1.05rem] leading-relaxed">{briefing}</p>
          </section>

<WeekCalendar weeks={weeks} domainLabel={DOMAIN} hasSources={ext.sources.length > 0} />

          <nav aria-label="Schnellaktionen" className="flex flex-wrap justify-center gap-2">
            <Link href="/aufgaben/neu" className="btn btn-secondary min-h-10 text-[.7rem]">+ Neue Aufgabe</Link>
            <Link href="/jarvis?f=heute" className="btn btn-secondary min-h-10 text-[.7rem]">▸ Was heute?</Link>
            <Link href="/jarvis?f=vergessen" className="btn btn-secondary min-h-10 text-[.7rem]">▸ Was vergesse ich?</Link>
          </nav>
        </div>

        {/* ───────────── LINKS ───────────── */}
        <div className="order-2 grid min-w-0 grid-cols-1 content-start gap-4 xl:order-1">
          <Panel n="01" title="Heute" aside={dateLong}>
            <div className="grid gap-3 sm:grid-cols-[1fr_1.1fr]">
              <ol className="relative hidden border-l border-line sm:block" aria-label="Tagesverlauf">
                {hours.map((h) => {
                  const at = todayTasks.filter((t) => hourIn(due(t)!, tz) === h);
                  const evAt = todayEvents.filter((e) => !e.allDay && hourIn(e.start, tz) === h);
                  const isNow = h === hour;
                  return (
                    <li key={h} className={`relative flex min-h-5 items-start gap-2 pl-2 ${isNow ? 'text-sea' : ''}`}>
                      {isNow && <span className="absolute -left-[5px] top-[7px] h-2 w-2 rotate-45 bg-sea shadow-[0_0_8px_#3fd2ff]" aria-label="jetzt" />}
                      <span className="mono w-6 shrink-0 text-[.62rem] leading-5 text-muted">{String(h).padStart(2, '0')}</span>
                      <span className="min-w-0 flex-1">
                        {isNow && <span className="mono block border-t border-dashed border-sea/70 text-[.58rem] uppercase tracking-widest text-sea">{hhmm(now, tz)} · jetzt</span>}
                        {evAt.map((e) => <span key={`${e.uid}${+e.start}`} className="block truncate text-[.75rem] text-good">◷ {hhmm(e.start, tz)} {e.title}</span>)}
                        {at.map((t) => <Link key={t.id} href={`/aufgaben/${t.id}`} className="block truncate text-[.75rem] text-ink">▪ {t.title}</Link>)}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <div>
                <p className="mono mb-1 text-[.62rem] uppercase tracking-widest text-muted">Voraus</p>
                {upcoming.length ? (
                  <ul className="grid gap-2">
                    {upcoming.map((t) => (
                      <li key={t.id} className="border-b border-line/70 pb-1.5">
                        <Link href={`/aufgaben/${t.id}`} className="block text-[.8rem] leading-snug">{t.title}</Link>
                        <span className="mono text-[.62rem] uppercase tracking-wider text-sea">{formatDue(t.due_at, tz)}</span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-muted">Keine Termine. Der Tag gehört dir.</p>}
              </div>
            </div>
          </Panel>

          <Panel n="02" title="Aufgaben" href="/aufgaben" aside={<><span className="text-bad">{overdue.length} überfällig</span> · {open.length} offen</>}>
            <div className="flex flex-wrap gap-1">
              <span className="mono border border-sea px-2 py-0.5 text-[.62rem] uppercase tracking-wider text-sea">Alle {open.length}</span>
              {domainCounts.map(([d, n]) => <span key={d} className="mono border border-line px-2 py-0.5 text-[.62rem] uppercase tracking-wider text-muted">{DOMAIN[d] ?? d} {n}</span>)}
            </div>
            {ranked.length ? (
              <ul className="grid grid-cols-1">
                {ranked.slice(0, 6).map(({ task }) => (
                  <li key={task.id} className="flex items-center gap-2 border-b border-line/60 py-1.5 text-[.85rem] last:border-0">
                    <span aria-hidden="true" className={task.row.due_at && due(task.row)! < now ? 'text-bad' : 'text-sea'}>◆</span>
                    <Link href={`/aufgaben/${task.id}`} className="min-w-0 flex-1 truncate">{task.title}</Link>
                    <span className="mono shrink-0 text-[.66rem] uppercase">{lateLabel(task.row)}</span>
                  </li>
                ))}
              </ul>
            ) : <Empty action={{ href: '/aufgaben/neu', label: 'Aufgabe anlegen' }}>Keine offenen Aufgaben</Empty>}
            {done.length > 0 && <p className="mono text-[.66rem] uppercase tracking-widest text-good">✓ {done.length} in 7 Tagen erledigt</p>}
          </Panel>

          <Panel n="03" title="Im Kopf" href="/eingang" aside={extra.stats.review ? <span className="text-warn">{extra.stats.review} zu prüfen</span> : 'Eingang leer'}>
            <QuickCapture bare />
            <p className="mono text-[.62rem] uppercase tracking-widest text-muted">E-Mail-Eingang: noch nicht verbunden</p>
          </Panel>
        </div>

        {/* ───────────── RECHTS ───────────── */}
        <div className="order-3 grid min-w-0 grid-cols-1 content-start gap-4">
          <Panel n="04" title="Geld" href="/leben/finanzen" aside={extra.stats.accounts ? `${extra.stats.accounts} Konten` : 'nicht verbunden'}>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Kontostand" value="—" sub={extra.stats.accounts ? 'Import ausstehend' : 'keine Kontodaten'} tone="muted" />
              <Metric label="1 € in AED" value={fx ? fx.eurAed.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '—'} sub={fx ? `EZB ${fx.date}` : 'Kurs nicht abrufbar'} tone="sea" />
              <Metric label="Buchungen" value={extra.stats.transactions} sub="importiert" tone="muted" />
              <Metric label="Offene Rechnungen" value="—" sub="noch keine Quelle" tone="muted" />
            </div>
            <Empty action={{ href: '/leben/finanzen', label: 'Finanzen ansehen' }}>Liquidität erscheint nach dem ersten Kontoauszug</Empty>
          </Panel>

          <Panel n="05" title="Dubai" href="/leben/dubai" aside={daysToMove !== null ? `T – ${daysToMove}` : 'Umzugsdatum offen'}>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Umzugsaufgaben" value={relocation.length} sub="offen" tone="sea" href="/leben/dubai" />
              <Metric label="Unterlagen Wohnung" value={`${Math.min(extra.stats.uae_docs, DUBAI_DOCS)}/${DUBAI_DOCS}`} sub={extra.property?.stage === 'handed_over' ? 'SPA, Title Deed, Bank …' : 'SPA, Oqood, Bank …'} tone={extra.stats.uae_docs >= DUBAI_DOCS ? 'good' : 'warn'} href="/leben/dokumente?ordner=uae_property" />
            </div>
            <Segments value={Math.min(extra.stats.uae_docs, DUBAI_DOCS)} total={DUBAI_DOCS} tone="warn" />
            {extra.property && (
              <p className="text-sm"><span className="font-semibold">{extra.property.project_name}</span>{extra.property.location ? <span className="text-muted"> · {extra.property.location}</span> : null}{extra.property.stage ? <span className="text-muted"> · {STAGE_LABEL[extra.property.stage]}</span> : null}</p>
            )}
            {ltv && !ltv.withinLimit && (
              <p className="notice notice-warn text-[.82rem]">▲ Geplant {Number(extra.property!.financing_ltv_pct)} % Finanzierung – CBUAE erlaubt hier höchstens {ltv.maxLtvPct} %. Mit der Bank klären.</p>
            )}
          </Panel>

          <Panel n="06" title="Verträge" href="/leben/vertraege" aside={`${extra.stats.contracts} echt${extra.stats.contracts_demo ? ` · ${extra.stats.contracts_demo} Beispiel` : ''}`}>
            {extra.cancellations.length ? (
              <ul className="grid gap-2.5">
                {extra.cancellations.map((c) => {
                  const idx = CANCELLATION_STEPS_DE.findIndex((x) => x.status === c.status);
                  return (
                    <li key={c.id}>
                      <Link href={`/leben/vertraege/${c.contract_id}`} className="flex items-baseline justify-between gap-2 text-[.85rem]">
                        <span className="truncate">{c.name}{c.is_demo && <span className="chip chip-demo ml-2">Beispiel</span>}</span>
                        <span className="mono shrink-0 text-[.64rem] uppercase tracking-wider text-sea">{CANCELLATION_STEPS_DE[idx]?.label ?? c.status}</span>
                      </Link>
                      <div className="mt-1"><Segments value={idx + 1} total={CANCELLATION_STEPS_DE.length} /></div>
                    </li>
                  );
                })}
              </ul>
            ) : <Empty action={{ href: '/leben/vertraege', label: 'Vertrag erfassen' }}>Keine laufenden Kündigungen</Empty>}
            <p className="mono text-[.62rem] uppercase tracking-widest text-muted">Versand nur mit deiner Freigabe + Code</p>
          </Panel>

          <Panel n="07" title="System" href="/leben/einstellungen" aside="EU · Irland">
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-[.8rem]">
              <SysRow ok label="2FA" value={s.aal === 'aal2' ? 'aktiv' : 'fehlt'} />
              <SysRow ok={extra.stats.chain_broken_at === null} label="Audit-Kette" value={extra.stats.chain_broken_at === null ? 'intakt' : `Bruch #${extra.stats.chain_broken_at}`} />
              <SysRow ok={!profile.kill_switch} label="Automatik" value={profile.kill_switch ? 'Notaus' : 'bereit'} />
              <SysRow ok={!paused} label="Erinnerungen" value={paused ? 'pausiert' : 'aktiv'} />
              <SysRow ok label="Dokumente" value={`${extra.stats.documents} sicher`} />
              <SysRow ok={!!weather && !!fx} label="Außendaten" value={weather && fx ? 'online' : 'teilweise'} />
              <SysRow ok={ext.sources.every((x) => x.ok)} label="Kalender" value={ext.sources.length ? `${ext.sources.filter((x) => x.ok).length}/${ext.sources.length} ok` : 'keiner'} />
              <SysRow ok={claudeAvailable()} label="Claude" value={claudeAvailable() ? (extra.stats.ai_consent ? 'verbunden' : 'bereit') : 'kein Schlüssel'} />
            </ul>
            <div className="border-t border-line pt-2">
              <p className="mono mb-1 text-[.6rem] uppercase tracking-widest text-muted">Protokoll</p>
              <ul className="mono grid gap-0.5 text-[.66rem] text-muted">
                {extra.log.map((l) => (
                  <li key={l.seq} className="flex gap-2"><span className="text-sea">{hhmm(new Date(l.created_at), tz)}</span><span className="truncate">{l.actor.toUpperCase()} · {l.action}</span></li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function CoreStat({ label, value, sub, tone, href }: { label: string; value: number; sub: string; tone: 'bad' | 'warn' | 'sea' | 'good' | 'muted'; href: string }) {
  const c = { bad: 'text-bad', warn: 'text-warn', sea: 'text-sea glow', good: 'text-good', muted: 'text-muted' }[tone];
  return (
    <Link href={href} className="block">
      <p className="mono break-words text-[.56rem] uppercase tracking-[.08em] text-muted sm:text-[.64rem] sm:tracking-[.22em]">{label}</p>
      <p className={`hud-num text-3xl font-light leading-none sm:text-5xl ${c}`}>{value}</p>
      <p className="mono mt-1 break-words text-[.54rem] uppercase text-muted sm:text-[.62rem] sm:tracking-wider">{sub}</p>
    </Link>
  );
}

function SysRow({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-2 border-b border-line/50 pb-1">
      <span className="mono text-[.64rem] uppercase tracking-wider text-muted">{label}</span>
      <span className={`mono flex items-center gap-1.5 text-[.7rem] uppercase ${ok ? 'text-good' : 'text-warn'}`}>
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${ok ? 'bg-good' : 'bg-warn'}`} />{value}
      </span>
    </li>
  );
}
