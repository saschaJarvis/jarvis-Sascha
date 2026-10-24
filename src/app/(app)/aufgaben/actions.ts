'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { friendlyDbError } from '@/server/db';
import { canTransition, TASK_STATUSES, type TaskStatus } from '@/lib/domain/taskStateMachine';
import { parseQuickCapture } from '@/lib/domain/quickCapture';
import { nextWeekMonday, toLocalParts, zonedToUtc } from '@/lib/domain/time';
import { storeUpload } from '@/server/storage';

export type ActionState = { error?: string; ok?: string } | undefined;

const uuid = z.string().uuid();

export async function transitionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireUser();
  const parsed = z.object({ id: uuid, to: z.enum(TASK_STATUSES), version: z.coerce.number().int() }).safeParse({
    id: fd.get('id'), to: fd.get('to'), version: fd.get('version'),
  });
  if (!parsed.success) return { error: 'Ungültige Anfrage.' };
  const { id, to, version } = parsed.data;
  try {
    const task = await db(s).task(id);
    if (!task) return { error: 'Aufgabe nicht gefunden.' };
    const gate = canTransition(task.status, to as TaskStatus, {
      evidenceRequired: task.evidence_required, acceptedEvidenceCount: task.accepted_evidence, openDependencyCount: task.open_deps,
    });
    if (!gate.ok) return { error: gate.reason };
    const rows = await db(s).run((q) => q('update tasks set status = $2 where id = $1 and version = $3 returning id', [id, to, version]));
    if (rows.length === 0) return { error: 'Die Aufgabe wurde inzwischen geändert. Bitte Seite neu laden.' };
  } catch (e) {
    return { error: friendlyDbError(e) };
  }
  revalidatePath('/', 'layout');
  return { ok: to === 'CLOSED' ? 'Erledigt. Gut gemacht.' : 'Gespeichert.' };
}

export async function snoozeAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const id = uuid.parse(fd.get('id'));
  const preset = z.enum(['2h', 'morgen', 'woche']).parse(fd.get('preset'));
  const profile = await db(s).profile();
  const tz = profile.timezone;
  const now = new Date();
  let until: Date;
  if (preset === '2h') until = new Date(now.getTime() + 2 * 3600_000);
  else if (preset === 'woche') until = nextWeekMonday(now, tz, 9);
  else {
    const p = toLocalParts(new Date(now.getTime() + 86_400_000), tz);
    until = zonedToUtc(p.year, p.month, p.day, 9, 0, tz);
  }
  await db(s).run((q) => q('update tasks set snoozed_until = $2 where id = $1', [id, until]));
  revalidatePath('/', 'layout');
}

export async function captureAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireUser();
  const text = String(fd.get('text') ?? '').trim();
  if (text.length < 2) return { error: 'Was soll ich mir merken?' };
  if (text.length > 500) return { error: 'Bitte kürzer (max. 500 Zeichen).' };
  const profile = await db(s).profile();
  const r = parseQuickCapture(text, new Date(), profile.timezone);
  const key = String(fd.get('idem') ?? '');
  try {
    await db(s).run((q) => q(
      `insert into tasks (user_id, title, due_at, status, certainty, source_ref, idempotency_key, urgency, impact)
       values (auth.uid(), $1, $2, 'READY', 'verified', $3, nullif($4, ''), 1, 1)
       on conflict (user_id, idempotency_key) do nothing`,
      [r.title.slice(0, 300), r.dueAt, JSON.stringify({ kind: 'quick_capture', text, assumptions: r.assumptions }), key]));
  } catch (e) {
    return { error: friendlyDbError(e) };
  }
  revalidatePath('/', 'layout');
  const when = r.dueAt ? ` – ${new Intl.DateTimeFormat('de-DE', { timeZone: profile.timezone, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(r.dueAt)}` : '';
  return { ok: `Notiert: „${r.title}"${when}${r.assumptions.length ? ` (${r.assumptions.join('; ')})` : ''}` };
}

export async function overrideAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const id = uuid.parse(fd.get('id'));
  const v = z.coerce.number().int().min(-3).max(3).parse(fd.get('value'));
  await db(s).run((q) => q('update tasks set user_priority_override = nullif($2, 0) where id = $1', [id, v]));
  revalidatePath('/', 'layout');
}

export async function evidenceNoteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireUser();
  const id = uuid.safeParse(fd.get('id'));
  const kind = z.enum(['note', 'not_available']).safeParse(fd.get('kind'));
  const note = String(fd.get('note') ?? '').trim();
  if (!id.success || !kind.success) return { error: 'Ungültige Anfrage.' };
  if (note.length < 3) return { error: 'Bitte kurz beschreiben.' };
  try {
    await db(s).run((q) => q(
      `insert into task_evidence (task_id, user_id, kind, note, review) values ($1, auth.uid(), $2, $3, $4)`,
      // Eine Notiz akzeptiert der Nutzer selbst; "nicht verfügbar" bleibt zur Prüfung offen
      [id.data, kind.data, note.slice(0, 2000), kind.data === 'note' ? 'accepted' : 'pending']));
  } catch (e) {
    return { error: friendlyDbError(e) };
  }
  revalidatePath(`/aufgaben/${id.data}`);
  return { ok: kind.data === 'note' ? 'Nachweis gespeichert.' : 'Vermerkt – zur Prüfung offen.' };
}

export async function evidenceUploadAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireUser();
  const id = uuid.safeParse(fd.get('id'));
  const file = fd.get('file');
  if (!id.success || !(file instanceof File) || file.size === 0) return { error: 'Bitte eine Datei auswählen.' };
  try {
    const task = await db(s).task(id.data);
    if (!task) return { error: 'Aufgabe nicht gefunden.' };
    const { documentId, scan } = await storeUpload(s, file, { title: `Nachweis: ${task.title}`.slice(0, 200), folder: 'other' });
    await db(s).run((q) => q(
      `insert into task_evidence (task_id, user_id, document_id, kind, review) values ($1, auth.uid(), $2, 'document', $3)`,
      [id.data, documentId, scan === 'clean' ? 'accepted' : 'pending']));
    if (scan === 'infected') return { error: 'Die Datei wurde als gefährlich erkannt und gesperrt.' };
  } catch (e) {
    return { error: e instanceof Error && e.message.startsWith('Datei') ? e.message : friendlyDbError(e) };
  }
  revalidatePath(`/aufgaben/${id.data}`);
  return { ok: 'Hochgeladen und geprüft.' };
}

export async function newTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireUser();
  const schema = z.object({
    title: z.string().trim().min(2).max(300),
    next_step: z.string().trim().max(300).optional(),
    due: z.string().optional(),
    urgency: z.coerce.number().int().min(0).max(3),
    evidence: z.string().optional(),
  });
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Bitte einen Titel angeben.' };
  const profile = await db(s).profile();
  let due: Date | null = null;
  if (p.data.due) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(p.data.due);
    if (!m) return { error: 'Datum ungültig.' };
    due = zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], profile.timezone);
  }
  let newId: string;
  try {
    const rows = await db(s).run((q) => q<{ id: string }>(
      `insert into tasks (user_id, title, next_step, due_at, urgency, impact, evidence_required, status, certainty)
       values (auth.uid(), $1, nullif($2,''), $3, $4, 2, $5, 'READY', 'verified') returning id`,
      [p.data.title, p.data.next_step ?? '', due, p.data.urgency, p.data.evidence === 'on']));
    newId = rows[0].id;
  } catch (e) {
    return { error: friendlyDbError(e) };
  }
  revalidatePath('/', 'layout');
  redirect(`/aufgaben/${newId}`);
}
