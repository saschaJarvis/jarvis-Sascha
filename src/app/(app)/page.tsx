import Link from 'next/link';
import { requireUser } from '@/server/auth';
import { db, asPriorityTask } from '@/server/repo';
import { buildTodayView } from '@/lib/domain/priority';
import { primaryActionFor } from '@/lib/domain/taskStateMachine';
import { Certainty, formatDue, Section } from '@/components/ui';
import { TransitionButton } from '@/components/task-actions';
import { SnoozeMenu } from '@/components/snooze';
import { QuickCapture } from '@/components/quick-capture';

export default async function TodayPage() {
  const s = await requireUser();
  const [profile, open, done] = await Promise.all([db(s).profile(), db(s).openTasks(), db(s).recentlyDone()]);
  const now = new Date();
  const tz = profile.timezone;
  const view = buildTodayView(open.map(asPriorityTask), now);
  const main = view.doThisNow?.task.row;
  const action = main ? primaryActionFor(main.status, main.evidence_required) : null;
  const greeting = new Intl.DateTimeFormat('de-DE', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const hour = Number(new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
  const hello = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';
  const paused = profile.paused_until && new Date(profile.paused_until) > now;
  const relocationOpen = open.filter((t) => t.domain === 'relocation').length;
  const daysToMove = profile.moving_date && profile.moving_date_certainty === 'verified'
    ? Math.ceil((Date.parse(`${profile.moving_date}T00:00:00Z`) - now.getTime()) / 86_400_000) : null;

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{greeting}</p>
          <h1 className="text-[1.7rem] font-bold leading-tight tracking-tight">{hello}{profile.display_name ? `, ${profile.display_name}` : ''}.</h1>
        </div>
        <Link href="/heute/ruhig" className="btn btn-secondary min-h-11 px-4 text-sm">Zu viel?</Link>
      </header>

      {paused && (
        <p className="notice notice-info mb-4">Erinnerungen pausiert bis {new Intl.DateTimeFormat('de-DE', { timeZone: tz, day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(profile.paused_until!))}. <Link className="underline" href="/leben/einstellungen">Ändern</Link></p>
      )}

      {main && view.doThisNow ? (
        <section aria-labelledby="jetzt" className="card border-2 border-sea p-5">
          <p id="jetzt" className="eyebrow text-sea">Jetzt das</p>
          <h2 className="mt-1 text-2xl font-bold leading-snug"><Link href={`/aufgaben/${main.id}`}>{main.title}</Link></h2>
          {main.next_step && <p className="mt-3 text-lg">→ {main.next_step}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            {formatDue(main.due_at, tz) && <span className="font-semibold">{formatDue(main.due_at, tz)}</span>}
            {main.effort_minutes && <span>ca. {main.effort_minutes} Min.</span>}
            {main.certainty !== 'verified' && <Certainty value={main.certainty} />}
          </div>
          {view.doThisNow.reasons.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-sea">Warum steht das oben?</summary>
              <ul className="mt-2 list-disc pl-5 text-muted">{view.doThisNow.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </details>
          )}
          <div className="mt-5 grid gap-2">
            {action && <TransitionButton id={main.id} version={main.version} to={action.to} label={action.label} big />}
            <div className="flex items-center justify-between">
              <Link href={`/aufgaben/${main.id}`} className="btn-quiet">Details</Link>
              <SnoozeMenu id={main.id} />
            </div>
          </div>
        </section>
      ) : (
        <section className="card p-5 text-center">
          <p className="text-2xl font-bold">Alles im Griff.</p>
          <p className="mt-1 text-muted">Gerade steht nichts Dringendes an. Schreib unten auf, was dir durch den Kopf geht.</p>
        </section>
      )}

      {view.alsoUrgent.length > 0 && (
        <Section title="Auch wichtig">
          <ul className="grid gap-2">
            {view.alsoUrgent.map(({ task }) => (
              <li key={task.id}>
                <Link href={`/aufgaben/${task.id}`} className="card flex items-center justify-between gap-3">
                  <span className="font-semibold">{task.title}</span>
                  <span className="shrink-0 text-sm text-muted">{formatDue(task.row.due_at, tz) ?? ''}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Kurz notieren">
        <QuickCapture />
      </Section>

      <Section title="Überblick">
        <div className="grid grid-cols-2 gap-2">
          <Link href="/leben/dubai" className="card">
            <p className="eyebrow">Dubai</p>
            <p className="mt-1 text-lg font-bold">{daysToMove !== null ? `${daysToMove} Tage` : 'Umzugsdatum offen'}</p>
            <p className="text-sm text-muted">{relocationOpen} Umzugsaufgaben offen</p>
          </Link>
          <Link href="/leben/finanzen" className="card">
            <p className="eyebrow">Geld</p>
            <p className="mt-1 text-lg font-bold">Noch keine Daten</p>
            <p className="text-sm text-muted">Kontoauszug hochladen</p>
          </Link>
        </div>
        {view.hiddenCount > 0 && (
          <p className="mt-3 text-sm text-muted"><Link href="/aufgaben" className="underline">{view.hiddenCount} weitere Aufgaben</Link> – bewusst ausgeblendet.</p>
        )}
        {done.length > 0 && <p className="mt-2 text-sm text-good">✓ {done.length} in den letzten 7 Tagen erledigt.</p>}
      </Section>
    </div>
  );
}
