import 'server-only';
import { withUser, Q } from './db';
import type { Session } from './auth';
import type { TaskStatus } from '@/lib/domain/taskStateMachine';
import type { PriorityTask } from '@/lib/domain/priority';

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  max_notifications_per_day: number;
  paused_until: Date | null;
  moving_date: string | null;
  moving_date_certainty: string | null;
  ui_mode: string;
  onboarding: Record<string, unknown>;
  kill_switch: boolean;
}

export interface TaskRow {
  id: string;
  title: string;
  why: string | null;
  domain: string;
  owner: string;
  status: TaskStatus;
  due_at: Date | null;
  due_is_hard: boolean;
  urgency: number;
  impact: number;
  money_at_risk_minor: string | null;
  money_currency: string | null;
  effort_minutes: number | null;
  evidence_required: boolean;
  evidence_hint: string | null;
  next_step: string | null;
  certainty: 'detected' | 'inferred' | 'verified';
  user_priority_override: number | null;
  snoozed_until: Date | null;
  version: number;
  created_at: Date;
  closed_at: Date | null;
  open_deps: number;
  blocks_count: number;
  accepted_evidence: number;
}

const TASK_SELECT = `
  select t.*,
    (select count(*)::int from task_dependencies d join tasks p on p.id = d.depends_on_id
      where d.task_id = t.id and p.status not in ('CLOSED','VERIFIED','CANCELLED') and p.deleted_at is null) as open_deps,
    (select count(*)::int from task_dependencies d join tasks c on c.id = d.task_id
      where d.depends_on_id = t.id and c.status not in ('CLOSED','VERIFIED','CANCELLED') and c.deleted_at is null) as blocks_count,
    (select count(*)::int from task_evidence e where e.task_id = t.id and e.review = 'accepted') as accepted_evidence
  from tasks t where t.deleted_at is null`;

export function asPriorityTask(t: TaskRow): PriorityTask & { row: TaskRow } {
  return {
    id: t.id, title: t.title, status: t.status, dueAt: t.due_at ? new Date(t.due_at) : null, dueIsHard: t.due_is_hard,
    urgency: t.urgency, impact: t.impact,
    moneyAtRiskEur: t.money_at_risk_minor && t.money_currency === 'EUR' ? Number(t.money_at_risk_minor) / 100 : undefined,
    effortMinutes: t.effort_minutes, certainty: t.certainty, blocksCount: t.blocks_count, openDependencyCount: t.open_deps,
    userPriorityOverride: t.user_priority_override, snoozedUntil: t.snoozed_until ? new Date(t.snoozed_until) : null,
    nextStep: t.next_step, row: t,
  };
}

export const db = (s: Session) => ({
  run: <T>(fn: (q: Q) => Promise<T>) => withUser(s.claims, fn),

  profile: () => withUser(s.claims, async (q) => (await q<Profile>('select * from profiles where id = auth.uid()'))[0]),

  openTasks: () => withUser(s.claims, (q) => q<TaskRow>(
    `${TASK_SELECT} and t.status not in ('CLOSED','CANCELLED') order by t.due_at nulls last, t.created_at`)),

  recentlyDone: () => withUser(s.claims, (q) => q<TaskRow>(
    `${TASK_SELECT} and t.status = 'CLOSED' and t.closed_at > now() - interval '7 days' order by t.closed_at desc limit 5`)),

  task: (id: string) => withUser(s.claims, async (q) => (await q<TaskRow>(`${TASK_SELECT} and t.id = $1`, [id]))[0] ?? null),

  taskDeps: (id: string) => withUser(s.claims, (q) => q<{ id: string; title: string; status: TaskStatus; direction: 'needs' | 'blocks' }>(
    `select p.id, p.title, p.status, 'needs' as direction from task_dependencies d join tasks p on p.id = d.depends_on_id where d.task_id = $1
     union all
     select c.id, c.title, c.status, 'blocks' from task_dependencies d join tasks c on c.id = d.task_id where d.depends_on_id = $1`, [id])),

  taskEvidence: (id: string) => withUser(s.claims, (q) => q<{ id: string; kind: string; note: string | null; review: string; created_at: Date;
      document_id: string | null; doc_title: string | null; scan_status: string | null; version_id: string | null }>(
    `select e.id, e.kind, e.note, e.review, e.created_at, e.document_id, d.title as doc_title,
            v.scan_status::text as scan_status, v.id as version_id
       from task_evidence e
       left join documents d on d.id = e.document_id
       left join lateral (select * from document_versions where document_id = d.id order by version_no desc limit 1) v on true
      where e.task_id = $1 order by e.created_at`, [id])),

  history: (entity: string, id: string) => withUser(s.claims, (q) => q<{ seq: string; actor: string; action: string; payload: Record<string, unknown>; created_at: Date }>(
    'select seq, actor, action, payload, created_at from audit_events where entity = $1 and entity_id = $2 order by seq desc limit 50', [entity, id])),
});
