'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser, stepUpFresh } from '@/server/auth';
import { db } from '@/server/repo';
import { friendlyDbError, withService } from '@/server/db';
import { buildCancellationDraft, hasPlaceholders, type ContractCategory } from '@/lib/domain/cancellationDraft';
import { canTransitionCancellation, type CancellationStatus, type ClosureItemState } from '@/lib/domain/cancellationStateMachine';
import { toLocalParts } from '@/lib/domain/time';

export type CState = { error?: string; ok?: string } | undefined;
const uuid = z.string().uuid();

interface ContractRow {
  id: string; name: string; category: ContractCategory; counterparty_name: string | null; counterparty_address: string | null;
  contract_number: string | null; earliest_end_date: string | null; earliest_end_certainty: string | null; is_demo: boolean;
}
interface CancelRow {
  id: string; contract_id: string; status: CancellationStatus; is_demo: boolean; draft_subject: string | null; draft_body: string | null;
  draft_sha256: string | null; dispatch_channel: string | null; checks: Record<string, unknown>; closure_checklist: Record<string, ClosureItemState>; version: number;
}

const back = (id: string) => `/leben/vertraege/${id}`;

export async function createDemoContractAction(): Promise<void> {
  const s = await requireUser();
  const rows = await db(s).run(async (q) => {
    const ex = await q<{ id: string }>(`select id from contracts where is_demo and category = 'commercial_lease' and deleted_at is null limit 1`);
    if (ex[0]) return ex;
    return q<{ id: string }>(`insert into contracts (user_id, name, category, is_demo, certainty, required_form)
      values (auth.uid(), 'Büromietvertrag Mainz (BEISPIEL)', 'commercial_lease', true, 'inferred', 'unknown') returning id`);
  });
  redirect(back(rows[0].id));
}

export async function newContractAction(_: CState, fd: FormData): Promise<CState> {
  const s = await requireUser();
  const p = z.object({
    name: z.string().trim().min(2).max(200),
    category: z.enum(['residential_lease', 'commercial_lease', 'storage', 'telecom', 'energy', 'insurance', 'subscription', 'banking', 'membership', 'vehicle', 'other']),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Bitte Name und Art angeben.' };
  let id: string;
  try {
    const r = await db(s).run((q) => q<{ id: string }>(
      `insert into contracts (user_id, name, category, certainty) values (auth.uid(), $1, $2, 'verified') returning id`, [p.data.name, p.data.category]));
    id = r[0].id;
  } catch (e) { return { error: friendlyDbError(e) }; }
  redirect(back(id));
}

export async function saveContractFactsAction(_: CState, fd: FormData): Promise<CState> {
  const s = await requireUser();
  const id = uuid.safeParse(fd.get('id'));
  if (!id.success) return { error: 'Ungültig.' };
  const v = (k: string) => { const x = String(fd.get(k) ?? '').trim(); return x === '' ? null : x.slice(0, 500); };
  const end = v('earliest_end_date');
  if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) return { error: 'Datum ungültig.' };
  try {
    await db(s).run((q) => q(
      `update contracts set counterparty_name = $2, counterparty_address = $3, contract_number = $4,
         earliest_end_date = $5, earliest_end_certainty = case when $5::date is null then null else 'verified'::certainty end,
         notice_period_text = $6, notice_period_certainty = case when $6 is null then null else 'verified'::certainty end
       where id = $1`, [id.data, v('counterparty_name'), v('counterparty_address'), v('contract_number'), end, v('notice_period_text')]));
  } catch (e) { return { error: friendlyDbError(e) }; }
  revalidatePath(back(id.data));
  return { ok: 'Gespeichert. Diese Angaben gelten jetzt als von dir bestätigt.' };
}

async function load(s: Awaited<ReturnType<typeof requireUser>>, contractId: string) {
  return db(s).run(async (q) => {
    const c = (await q<ContractRow>('select * from contracts where id = $1', [contractId]))[0];
    const r = (await q<CancelRow>(`select * from cancellation_requests where contract_id = $1 and deleted_at is null order by created_at desc limit 1`, [contractId]))[0];
    return { c, r };
  });
}

export async function startCancellationAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const contractId = uuid.parse(fd.get('contract_id'));
  const { c } = await load(s, contractId);
  if (!c) redirect('/leben/vertraege');
  await db(s).run(async (q) => {
    const r = await q<{ id: string }>(`insert into cancellation_requests (user_id, contract_id, is_demo, status) values (auth.uid(), $1, $2, 'DETECTED') returning id`, [c.id, c.is_demo]);
    await q(`update cancellation_requests set status = 'TERMS_REVIEW' where id = $1`, [r[0].id]);
  });
  revalidatePath(back(contractId));
}

export async function buildDraftAction(_: CState, fd: FormData): Promise<CState> {
  const s = await requireUser();
  const contractId = uuid.parse(fd.get('contract_id'));
  const v = (k: string) => { const x = String(fd.get(k) ?? '').trim(); return x === '' ? null : x.slice(0, 300); };
  const fixed = fd.get('fixed_term');
  const profile = await db(s).profile();
  const { c, r } = await load(s, contractId);
  if (!c || !r) return { error: 'Vorgang nicht gefunden.' };
  const lp = toLocalParts(new Date(), profile.timezone);
  const today = `${lp.year}-${String(lp.month).padStart(2, '0')}-${String(lp.day).padStart(2, '0')}`;
  const draft = buildCancellationDraft({
    name: c.name.replace(' (BEISPIEL)', ''), category: c.category, counterpartyName: c.counterparty_name, counterpartyAddress: c.counterparty_address,
    contractNumber: c.contract_number, verifiedEndDate: c.earliest_end_certainty === 'verified' ? c.earliest_end_date : null,
    objectAddress: v('object_address'), fixedTerm: fixed === 'yes' ? true : fixed === 'no' ? false : null,
  }, { fullName: v('sender_name'), address: v('sender_address'), city: v('sender_city') }, today);
  try {
    await db(s).run((q) => q(
      `update cancellation_requests set status = 'DRAFT', draft_subject = $2, draft_body = $3, dispatch_channel = $4,
         checks = $5, closure_checklist = $6 where id = $1 and status in ('TERMS_REVIEW','DRAFT')`,
      [r.id, draft.subject, draft.body, draft.recommendedChannel,
        JSON.stringify({ items: draft.checks, missing: draft.missing, blockers: draft.blockers, followUps: draft.followUpTasks, wetSignature: draft.requiresWetSignature }),
        JSON.stringify(draft.closureChecklist)]));
  } catch (e) { return { error: friendlyDbError(e) }; }
  revalidatePath(back(contractId));
  return { ok: 'Entwurf erstellt.' };
}

export async function saveDraftAction(_: CState, fd: FormData): Promise<CState> {
  const s = await requireUser();
  const contractId = uuid.parse(fd.get('contract_id'));
  const body = String(fd.get('draft_body') ?? '').slice(0, 20000);
  const subject = String(fd.get('draft_subject') ?? '').slice(0, 300);
  const channel = z.enum(['postal_registered', 'postal_courier', 'email', 'online_button', 'in_person']).safeParse(fd.get('dispatch_channel'));
  const toReview = fd.get('intent') === 'review';
  const { r } = await load(s, contractId);
  if (!r) return { error: 'Vorgang nicht gefunden.' };
  if (!channel.success) return { error: 'Bitte Versandweg wählen.' };
  const blockers = (r.checks?.blockers as string[] | undefined) ?? [];
  if (toReview) {
    if (blockers.length) return { error: `Geht so nicht: ${blockers.join('; ')}` };
    if (hasPlaceholders(body) && !r.is_demo) return { error: 'Im Entwurf stehen noch „[BITTE ERGÄNZEN …]“-Stellen.' };
    const gate = canTransitionCancellation('DRAFT', 'USER_REVIEW', { hasDraft: body.length > 20, hasDispatchChannel: true, hasFreshBoundApproval: false, hasDispatchRecord: false, closureChecklist: {} });
    if (!gate.ok) return { error: gate.reason };
  }
  try {
    await db(s).run((q) => q(
      `update cancellation_requests set draft_subject = $2, draft_body = $3, dispatch_channel = $4,
         status = case when $5 then 'USER_REVIEW'::cancellation_status else status end where id = $1`,
      [r.id, subject, body, channel.data, toReview]));
  } catch (e) { return { error: friendlyDbError(e) }; }
  revalidatePath(back(contractId));
  return { ok: toReview ? 'Bereit zur Freigabe.' : 'Gespeichert.' };
}

export async function backToDraftAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const contractId = uuid.parse(fd.get('contract_id'));
  const { r } = await load(s, contractId);
  if (r) await db(s).run((q) => q(`update cancellation_requests set status = 'DRAFT' where id = $1 and status in ('USER_REVIEW','APPROVED','ERROR')`, [r.id]));
  revalidatePath(back(contractId));
}

export async function approveAction(_: CState, fd: FormData): Promise<CState> {
  const s = await requireUser();
  const contractId = uuid.parse(fd.get('contract_id'));
  const sha = String(fd.get('sha') ?? '');
  if (fd.get('confirm') !== 'on') return { error: 'Bitte bestätige, dass du den Entwurf geprüft hast.' };
  if (!stepUpFresh(s)) {
    redirect(`/sicherheit/code?weiter=${encodeURIComponent(back(contractId) + '#freigabe')}&grund=${encodeURIComponent('Du gibst eine Kündigung frei.')}`);
  }
  const { r } = await load(s, contractId);
  if (!r) return { error: 'Vorgang nicht gefunden.' };
  const statement = r.is_demo
    ? 'Ich habe den Entwurf geprüft und gebe ihn für einen SIMULIERTEN Versand frei (Demo – es wird nichts verschickt).'
    : 'Ich habe den Entwurf geprüft und gebe ihn zum Versand frei.';
  try {
    await db(s).run((q) => q('select app.approve_cancellation($1, $2, $3)', [r.id, sha, statement]));
  } catch (e) { return { error: friendlyDbError(e) }; }
  revalidatePath(back(contractId));
  return { ok: 'Freigegeben.' };
}

export async function sendAction(_: CState, fd: FormData): Promise<CState> {
  const s = await requireUser();
  const contractId = uuid.parse(fd.get('contract_id'));
  const { r } = await load(s, contractId);
  if (!r || r.status !== 'APPROVED') return { error: 'Erst freigeben.' };
  try {
    if (r.is_demo) {
      await db(s).run((q) => q('select app.simulate_send_demo_cancellation($1)', [r.id]));
    } else {
      // Echte Kündigung: Sascha verschickt den unterschriebenen Brief selbst; Jarvis verbucht das.
      if (fd.get('self_sent') !== 'on') return { error: 'Bitte bestätige, dass du den unterschriebenen Brief abgeschickt hast.' };
      const approval = await db(s).run((q) => q<{ id: string }>(
        `select id from approvals where subject_type = 'cancellation' and subject_id = $1 and content_sha256 = $2 order by created_at desc limit 1`, [r.id, r.draft_sha256]));
      if (!approval[0]) return { error: 'Freigabe nicht gefunden.' };
      await withService((q) => q(
        `insert into outbound_messages (user_id, cancellation_request_id, approval_id, channel, mode, subject, body_sha256, status, idempotency_key, dispatched_at)
         values ($1, $2, $3, 'postal', 'real', $4, $5, 'dispatched', $6, now())`,
        [s.userId, r.id, approval[0].id, r.draft_subject, r.draft_sha256, `postal-${r.id}`]));
      await db(s).run(async (q) => {
        await q(`update cancellation_requests set status = 'SENT' where id = $1`, [r.id]);
        const follow = ((r.checks?.followUps as string[] | undefined) ?? []);
        for (const f of follow) {
          await q(`insert into tasks (user_id, title, domain, status, urgency, impact, certainty, idempotency_key, why)
                   values (auth.uid(), $1, 'contracts', 'READY', 2, 2, 'verified', $2, 'Nachweis, dass die Kündigung angekommen ist.') on conflict do nothing`,
            [f, `follow-${r.id}-${f.slice(0, 20)}`]);
        }
      });
    }
  } catch (e) { return { error: friendlyDbError(e) }; }
  revalidatePath(back(contractId));
  return { ok: r.is_demo ? 'Simuliert versendet – es wurde nichts verschickt.' : 'Versand verbucht.' };
}

export async function advanceAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const contractId = uuid.parse(fd.get('contract_id'));
  const to = z.enum(['DELIVERY_EVIDENCE', 'CONFIRMED', 'CLOSED', 'DISPUTED']).parse(fd.get('to'));
  const { r } = await load(s, contractId);
  if (!r) return;
  await db(s).run((q) => q('update cancellation_requests set status = $2 where id = $1', [r.id, to])).catch(() => {});
  revalidatePath(back(contractId));
}

export async function closureItemAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const contractId = uuid.parse(fd.get('contract_id'));
  const key = z.string().regex(/^[a-z_]{2,40}$/).parse(fd.get('key'));
  const value = z.enum(['open', 'done', 'not_applicable']).parse(fd.get('value'));
  const { r } = await load(s, contractId);
  if (!r || !(key in (r.closure_checklist ?? {}))) return;
  await db(s).run((q) => q(`update cancellation_requests set closure_checklist = closure_checklist || jsonb_build_object($2::text, $3::text) where id = $1`, [r.id, key, value]));
  revalidatePath(back(contractId));
}

export async function closeAction(_: CState, fd: FormData): Promise<CState> {
  const s = await requireUser();
  const contractId = uuid.parse(fd.get('contract_id'));
  const { r } = await load(s, contractId);
  if (!r) return { error: 'Vorgang nicht gefunden.' };
  const gate = canTransitionCancellation(r.status, 'CLOSED', { hasDraft: true, hasDispatchChannel: true, hasFreshBoundApproval: true, hasDispatchRecord: true, closureChecklist: r.closure_checklist });
  if (!gate.ok) return { error: gate.reason };
  try { await db(s).run((q) => q(`update cancellation_requests set status = 'CLOSED' where id = $1`, [r.id])); }
  catch (e) { return { error: friendlyDbError(e) }; }
  revalidatePath(back(contractId));
  return { ok: 'Abgeschlossen.' };
}
