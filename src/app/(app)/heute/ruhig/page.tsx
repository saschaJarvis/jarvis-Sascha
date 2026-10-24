import Link from 'next/link';
import { requireUser } from '@/server/auth';
import { db, asPriorityTask } from '@/server/repo';
import { overwhelmedPick } from '@/lib/domain/priority';
import { primaryActionFor } from '@/lib/domain/taskStateMachine';
import { TransitionButton } from '@/components/task-actions';
import { pauseAction } from '@/app/(app)/leben/einstellungen/actions';

export default async function CalmPage() {
  const s = await requireUser();
  const open = await db(s).openTasks();
  const pick = overwhelmedPick(open.map(asPriorityTask), new Date());
  const t = pick?.task.row;
  const action = t ? primaryActionFor(t.status, t.evidence_required) : null;
  return (
    <div className="pt-6">
      <p className="eyebrow">Durchatmen</p>
      <h1 className="text-[1.7rem] font-bold leading-tight">Nur eine Sache. Der Rest wartet.</h1>
      {t ? (
        <section className="card mt-6 p-5">
          <p className="text-xl font-bold">{t.title}</p>
          {t.next_step && <p className="mt-2 text-lg">→ {t.next_step}</p>}
          {t.effort_minutes && <p className="mt-1 text-sm text-muted">ca. {t.effort_minutes} Minuten</p>}
          {action && <div className="mt-4"><TransitionButton id={t.id} version={t.version} to={action.to} label={action.label} big /></div>}
        </section>
      ) : <p className="card mt-6">Gerade gibt es nichts zu tun. Wirklich nichts.</p>}

      <h2 className="eyebrow mt-8 mb-2">Oder</h2>
      <form action={pauseAction} className="grid gap-2">
        <button name="hours" value="24" className="btn btn-secondary">Erinnerungen 24 Stunden pausieren</button>
        <button name="hours" value="72" className="btn btn-secondary">Bis übermorgen Ruhe</button>
      </form>
      <Link href="/" className="btn-quiet mt-4 inline-flex">Zurück zu Heute</Link>
    </div>
  );
}
