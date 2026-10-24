import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { primaryActionFor, TASK_STATUS_LABEL_DE, TASK_TRANSITIONS, canTransition } from '@/lib/domain/taskStateMachine';
import { Certainty, formatDateTime, formatDue, PageTitle } from '@/components/ui';
import { TransitionButton } from '@/components/task-actions';
import { SnoozeMenu } from '@/components/snooze';
import { EvidenceForms } from './evidence-forms';
import { overrideAction } from '../actions';

const ACTION_LABEL: Record<string, string> = {
  'audit:task.created': 'Angelegt', 'audit:task.status': 'Status geändert', 'audit:evidence.review': 'Nachweis geprüft',
};

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await requireUser();
  const [profile, task] = await Promise.all([db(s).profile(), db(s).task(id)]);
  if (!task) notFound();
  const [deps, evidence, history] = await Promise.all([db(s).taskDeps(id), db(s).taskEvidence(id), db(s).history('task', id)]);
  const tz = profile.timezone;
  const primary = primaryActionFor(task.status, task.evidence_required);
  const ctx = { evidenceRequired: task.evidence_required, acceptedEvidenceCount: task.accepted_evidence, openDependencyCount: task.open_deps };
  const secondary = TASK_TRANSITIONS[task.status]
    .filter((to) => to !== primary?.to && ['WAITING_FOR_THIRD_PARTY', 'BLOCKED', 'CANCELLED', 'READY'].includes(to))
    .filter((to) => canTransition(task.status, to, ctx).ok);
  const sourceRef = (task as unknown as { source_ref: { text?: string; assumptions?: string[] } | null }).source_ref;

  return (
    <article>
      <PageTitle back={{ href: '/', label: 'Heute' }} eyebrow={TASK_STATUS_LABEL_DE[task.status]} title={task.title} />

      <dl className="grid gap-4">
        <div className="card">
          <dt className="eyebrow">Warum</dt>
          <dd className="mt-1">{task.why ?? <span className="text-muted">Noch kein Grund notiert.</span>}</dd>
        </div>
        <div className="card flex items-center justify-between gap-3">
          <div>
            <dt className="eyebrow">Bis wann</dt>
            <dd className="mt-1 font-semibold">{formatDue(task.due_at, tz) ?? 'ohne Frist'}{task.due_is_hard && <span className="ml-2 chip chip-inferred">feste Frist</span>}</dd>
          </div>
          <Certainty value={task.certainty} />
        </div>
        {task.next_step && (
          <div className="card bg-sea-soft">
            <dt className="eyebrow">Nächster kleiner Schritt</dt>
            <dd className="mt-1 text-lg font-semibold">{task.next_step}</dd>
          </div>
        )}
        {sourceRef?.text && (
          <div className="card">
            <dt className="eyebrow">Was Jarvis verstanden hat</dt>
            <dd className="mt-1 text-sm">„{sourceRef.text}“{sourceRef.assumptions?.length ? <span className="block text-muted">Annahmen: {sourceRef.assumptions.join('; ')}</span> : null}</dd>
          </div>
        )}
      </dl>

      {task.open_deps > 0 && (
        <p className="notice notice-warn mt-4">Erst die Vorbedingung erledigen: {deps.filter((d) => d.direction === 'needs' && !['CLOSED', 'VERIFIED', 'CANCELLED'].includes(d.status)).map((d) => (
          <Link key={d.id} className="underline" href={`/aufgaben/${d.id}`}>{d.title}</Link>))}</p>
      )}

      <div className="mt-6 grid gap-2">
        {primary && <TransitionButton id={task.id} version={task.version} to={primary.to} label={primary.label} big />}
        <div className="flex items-center justify-between">
          <SnoozeMenu id={task.id} />
          <form action={overrideAction} className="flex items-center gap-1">
            <input type="hidden" name="id" value={task.id} />
            <button name="value" value={String(Math.min(3, (task.user_priority_override ?? 0) + 1))} className="btn-quiet" aria-label="Wichtiger machen">▲ wichtiger</button>
            <button name="value" value={String(Math.max(-3, (task.user_priority_override ?? 0) - 1))} className="btn-quiet" aria-label="Unwichtiger machen">▼</button>
          </form>
        </div>
      </div>

      {(task.evidence_required || evidence.length > 0) && (
        <section className="mt-8">
          <h2 className="eyebrow mb-2">Nachweis</h2>
          {task.evidence_hint && <p className="mb-3 text-muted">Gebraucht: {task.evidence_hint}</p>}
          <ul className="mb-3 grid gap-2">
            {evidence.map((e) => (
              <li key={e.id} className="card flex items-center justify-between gap-3 text-sm">
                <span>
                  {e.kind === 'document' ? (e.version_id && e.scan_status === 'clean' ? <a className="underline" href={`/api/datei/${e.version_id}`}>{e.doc_title}</a> : e.doc_title)
                    : e.kind === 'not_available' ? `Nicht verfügbar: ${e.note}` : e.note}
                  {e.scan_status && e.scan_status !== 'clean' && <span className="ml-2 chip chip-inferred">Virenprüfung: {e.scan_status}</span>}
                </span>
                <span className={`chip ${e.review === 'accepted' ? 'chip-verified' : e.review === 'rejected' ? 'chip-inferred' : 'chip-detected'}`}>
                  {e.review === 'accepted' ? 'akzeptiert' : e.review === 'rejected' ? 'abgelehnt' : 'offen'}
                </span>
              </li>
            ))}
          </ul>
          {!['CLOSED', 'CANCELLED', 'VERIFIED'].includes(task.status) && <EvidenceForms id={task.id} />}
          {task.status === 'EVIDENCE_PENDING' && task.accepted_evidence > 0 && (
            <div className="mt-3"><TransitionButton id={task.id} version={task.version} to="VERIFIED" label="Nachweis passt – bestätigen" /></div>
          )}
        </section>
      )}

      {secondary.length > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer text-sea">Weitere Möglichkeiten</summary>
          <div className="mt-3 grid gap-2">
            {secondary.map((to) => (
              <TransitionButton key={to} id={task.id} version={task.version} to={to} variant="secondary"
                label={to === 'WAITING_FOR_THIRD_PARTY' ? 'Warte auf jemand anderen' : to === 'BLOCKED' ? 'Komme nicht weiter (blockiert)' : to === 'CANCELLED' ? 'Nicht mehr nötig' : 'Zurück auf „bereit“'} />
            ))}
          </div>
        </details>
      )}

      <details className="mt-6">
        <summary className="cursor-pointer text-sea">Verlauf</summary>
        <ol className="mt-3 grid gap-1 text-sm text-muted">
          {history.map((h) => (
            <li key={h.seq}>{formatDateTime(h.created_at, tz)} · {ACTION_LABEL[`audit:${h.action}`] ?? h.action}
              {h.payload?.from ? ` (${TASK_STATUS_LABEL_DE[h.payload.from as keyof typeof TASK_STATUS_LABEL_DE] ?? h.payload.from} → ${TASK_STATUS_LABEL_DE[h.payload.to as keyof typeof TASK_STATUS_LABEL_DE] ?? h.payload.to})` : ''}</li>
          ))}
        </ol>
      </details>
    </article>
  );
}
