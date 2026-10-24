import Link from 'next/link';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { Certainty, PageTitle, Section } from '@/components/ui';
import { TransitionButton } from '@/components/task-actions';

export default async function InboxPage() {
  const s = await requireUser();
  const open = await db(s).openTasks();
  const review = open.filter((t) => t.status === 'DETECTED' || t.status === 'NEEDS_REVIEW');
  const pendingEvidence = await db(s).run((q) => q<{ id: string; task_id: string; title: string; note: string | null }>(
    `select e.id, e.task_id, t.title, e.note from task_evidence e join tasks t on t.id = e.task_id
      where e.review = 'pending' and e.kind = 'not_available' order by e.created_at`));
  return (
    <div>
      <PageTitle title="Eingang" />
      <p className="notice notice-info">E-Mail ist noch nicht verbunden. Sobald Gmail oder Outlook angebunden ist, erscheinen hier Rechnungen, Fristen und Antwortentwürfe zur Prüfung – Jarvis liest dann nur, sendet nie ungefragt.</p>

      <Section title={`Zu prüfen (${review.length})`}>
        {review.length === 0 ? <p className="text-muted">Nichts zu prüfen.</p> : (
          <ul className="grid gap-2">
            {review.map((t) => (
              <li key={t.id} className="card grid gap-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/aufgaben/${t.id}`} className="font-semibold">{t.title}</Link>
                  <Certainty value={t.certainty} />
                </div>
                {t.why && <p className="text-sm text-muted">{t.why}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <TransitionButton id={t.id} version={t.version} to="READY" label="Stimmt" />
                  <TransitionButton id={t.id} version={t.version} to="CANCELLED" label="Verwerfen" variant="secondary" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {pendingEvidence.length > 0 && (
        <Section title="Nachweise ohne Beleg">
          <ul className="grid gap-2">
            {pendingEvidence.map((e) => (
              <li key={e.id}><Link className="card block" href={`/aufgaben/${e.task_id}`}><strong>{e.title}</strong><span className="block text-sm text-muted">{e.note}</span></Link></li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
