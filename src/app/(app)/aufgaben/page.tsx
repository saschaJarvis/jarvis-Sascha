import Link from 'next/link';
import { requireUser } from '@/server/auth';
import { db, asPriorityTask } from '@/server/repo';
import { scoreTask } from '@/lib/domain/priority';
import { TASK_STATUS_LABEL_DE } from '@/lib/domain/taskStateMachine';
import { formatDue, PageTitle } from '@/components/ui';

export default async function TasksPage() {
  const s = await requireUser();
  const [profile, open] = await Promise.all([db(s).profile(), db(s).openTasks()]);
  const now = new Date();
  const scored = open.map((t) => scoreTask(asPriorityTask(t), now)).sort((a, b) => b.score - a.score);
  return (
    <div>
      <PageTitle back={{ href: '/', label: 'Heute' }} title="Alle offenen Aufgaben" />
      <Link href="/aufgaben/neu" className="btn btn-primary mb-4 w-full">+ Neue Aufgabe</Link>
      <ul className="grid gap-2">
        {scored.map(({ task }) => (
          <li key={task.id}>
            <Link href={`/aufgaben/${task.id}`} className="card flex items-center justify-between gap-3">
              <span>
                <span className="block font-semibold">{task.title}</span>
                <span className="text-sm text-muted">{TASK_STATUS_LABEL_DE[task.status]}{task.snoozedUntil && task.snoozedUntil > now ? ' · später' : ''}</span>
              </span>
              <span className="shrink-0 text-sm text-muted">{formatDue(task.row.due_at, profile.timezone) ?? ''}</span>
            </Link>
          </li>
        ))}
      </ul>
      {scored.length === 0 && <p className="text-muted">Keine offenen Aufgaben.</p>}
    </div>
  );
}
