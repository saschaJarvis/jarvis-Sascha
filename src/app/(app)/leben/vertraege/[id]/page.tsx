import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser, stepUpFresh } from '@/server/auth';
import { db } from '@/server/repo';
import { Certainty, formatDateTime, PageTitle, Section } from '@/components/ui';
import { CANCELLATION_STEPS_DE, type CancellationStatus, type ClosureItemState } from '@/lib/domain/cancellationStateMachine';
import { hasPlaceholders, type DraftCheck } from '@/lib/domain/cancellationDraft';
import { CATEGORY_LABEL, CHANNEL_LABEL, CLOSURE_LABEL } from '@/lib/labels';
import { advanceAction, backToDraftAction, closureItemAction, startCancellationAction } from '../actions';
import { ApproveForm, CloseForm, DraftEditor, DraftStarter, FactsForm, SendForm } from './forms';

interface C { id: string; name: string; category: string; counterparty_name: string | null; counterparty_address: string | null; contract_number: string | null;
  earliest_end_date: string | null; earliest_end_certainty: string | null; notice_period_text: string | null; notice_period_certainty: string | null;
  amount_minor: string | null; currency: string | null; is_demo: boolean; certainty: string;
  start_date: string | null; billing_interval: string | null; deposit_minor: string | null; source_document_id: string | null }
interface R { id: string; status: CancellationStatus; is_demo: boolean; draft_subject: string | null; draft_body: string | null; draft_sha256: string | null;
  dispatch_channel: string | null; checks: { items?: DraftCheck[]; missing?: string[]; blockers?: string[]; wetSignature?: boolean };
  closure_checklist: Record<string, ClosureItemState>; created_at: Date }

const INTERVAL: Record<string, string> = { monthly: ' / Monat', quarterly: ' / Quartal', yearly: ' / Jahr', one_off: ' einmalig' };

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await requireUser();
  const profile = await db(s).profile();
  const data = await db(s).run(async (q) => {
    const c = (await q<C>('select * from contracts where id = $1 and deleted_at is null', [id]))[0];
    if (!c) return null;
    const r = (await q<R>('select * from cancellation_requests where contract_id = $1 and deleted_at is null order by created_at desc limit 1', [id]))[0] ?? null;
    const msgs = r ? await q<{ id: string; mode: string; channel: string; status: string; dispatched_at: Date | null; body_sha256: string }>(
      'select id, mode, channel, status, dispatched_at, body_sha256 from outbound_messages where cancellation_request_id = $1 order by created_at', [r.id]) : [];
    const approvals = r ? await q<{ id: string; is_simulated: boolean; created_at: Date; content_sha256: string; statement: string }>(
      `select id, is_simulated, created_at, content_sha256, statement from approvals where subject_type = 'cancellation' and subject_id = $1 order by created_at desc`, [r.id]) : [];
    const docs = await q<{ id: string; title: string; version_id: string | null; scan_status: string | null; created_at: Date }>(
      `select d.id, d.title, d.created_at, v.id as version_id, v.scan_status::text as scan_status
         from documents d
         left join lateral (select * from document_versions where document_id = d.id order by version_no desc limit 1) v on true
        where d.deleted_at is null and (d.id = $2::uuid or d.extracted->>'contract_id' = $1::text)
        order by d.created_at`, [id, c.source_document_id]);
    return { c, r, msgs, approvals, docs };
  });
  if (!data) notFound();
  const { c, r, msgs, approvals, docs } = data;
  const tz = profile.timezone;
  const stepIndex = r ? CANCELLATION_STEPS_DE.findIndex((x) => x.status === r.status) : -1;
  const freshApproval = r && approvals.find((a) => a.content_sha256 === r.draft_sha256);

  return (
    <div>
      <PageTitle back={{ href: '/leben/vertraege', label: 'Verträge' }} eyebrow={CATEGORY_LABEL[c.category]} title={c.name} />
      {c.is_demo && (
        <p className="notice notice-info mb-4"><strong>Beispiel.</strong> Dieser Vertrag dient nur zum Ausprobieren. Hier wird niemals etwas verschickt – jeder „Versand“ ist eine Simulation.</p>
      )}

      <Section title="Was Jarvis weiß">
        <div className="card grid gap-2 text-sm">
          <Fact label="Vertragspartner" value={c.counterparty_name} />
          <Fact label="Anschrift" value={c.counterparty_address} />
          <Fact label="Vertragsnummer" value={c.contract_number} />
          <Fact label="Kündigungsfrist (laut Vertrag)" value={c.notice_period_text} c={c.notice_period_certainty} />
          <Fact label="Frühestes Ende" value={c.earliest_end_date ? new Date(c.earliest_end_date).toLocaleDateString('de-DE') : null} c={c.earliest_end_certainty} />
          <Fact label="Beginn" value={c.start_date ? new Date(c.start_date).toLocaleDateString('de-DE') : null} />
          <Fact label="Miete/Betrag" value={c.amount_minor ? `${(Number(c.amount_minor) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${c.currency}${INTERVAL[c.billing_interval ?? ''] ?? ''}` : null} />
          {c.deposit_minor && <Fact label="Kaution" value={`${(Number(c.deposit_minor) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} ${c.currency ?? ''}`} />}
          {c.certainty === 'detected' && <p className="text-xs text-warn">Von Claude aus den Unterlagen gelesen – bitte einmal gegenprüfen.</p>}
          <details className="mt-1"><summary className="cursor-pointer text-sea">Angaben aus dem Vertrag eintragen</summary><FactsForm c={c} /></details>
          <p className="text-xs text-muted">Unbekanntes bleibt leer. Jarvis rät keine Fristen.</p>
        </div>
      </Section>

      {docs.length > 0 && (
        <Section title="Unterlagen">
          <ul className="card grid gap-1.5 text-sm">
            {docs.map((d) => (
              <li key={d.id}>
                {d.version_id && d.scan_status === 'clean'
                  ? <a href={`/api/datei/${d.version_id}`} className="underline">{d.title}</a>
                  : <span>{d.title}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Kündigung" aside={r ? <span className="text-sm text-muted">Schritt {Math.max(1, stepIndex + 1)} von {CANCELLATION_STEPS_DE.length}</span> : null}>
        {r && (
          <ol className="mb-4 flex gap-1" aria-label="Fortschritt">
            {CANCELLATION_STEPS_DE.map((st, i) => (
              <li key={st.status} title={st.label} className={`h-2 flex-1 rounded-full ${i <= stepIndex ? 'bg-sea' : 'bg-line'}`}><span className="sr-only">{st.label}{i <= stepIndex ? ' (erreicht)' : ''}</span></li>
            ))}
          </ol>
        )}
        {r && ['BLOCKED', 'ERROR', 'DISPUTED'].includes(r.status) && <p className="notice notice-bad mb-3">Status: {r.status === 'BLOCKED' ? 'blockiert' : r.status === 'ERROR' ? 'Fehler' : 'strittig'}</p>}

        {!r && (
          <form action={startCancellationAction} className="card grid gap-3">
            <input type="hidden" name="contract_id" value={c.id} />
            <p>Jarvis bereitet die Kündigung vor. Du prüfst, gibst frei und entscheidest über den Versand.</p>
            <button className="btn btn-primary">Kündigung vorbereiten</button>
          </form>
        )}

        {r?.status === 'TERMS_REVIEW' && <DraftStarter contractId={c.id} category={c.category} defaults={{ sender_name: profile.display_name ?? '' }} />}

        {r && (r.status === 'DRAFT') && r.draft_body && (
          <>
            <Checks checks={r.checks} />
            <DraftEditor contractId={c.id} subject={r.draft_subject ?? ''} body={r.draft_body} channel={r.dispatch_channel ?? 'postal_registered'}
              isDemo={r.is_demo} placeholders={hasPlaceholders(r.draft_body)} channels={CHANNEL_LABEL} />
          </>
        )}

        {r?.status === 'USER_REVIEW' && r.draft_body && (
          <div className="grid gap-4" id="freigabe">
            <p className="eyebrow">Letzte Ansicht vor der Freigabe</p>
            <Letter subject={r.draft_subject} body={r.draft_body} />
            <p className="text-sm">Versandweg: <strong>{CHANNEL_LABEL[r.dispatch_channel ?? ''] ?? '–'}</strong>{r.checks?.wetSignature ? ' · eigenhändige Unterschrift nötig' : ''}</p>
            <Checks checks={r.checks} />
            {r.is_demo && hasPlaceholders(r.draft_body) && <p className="notice notice-warn">Beispiel mit offenen Platzhaltern – bei einem echten Vertrag wäre die Freigabe so gesperrt.</p>}
            <ApproveForm contractId={c.id} sha={r.draft_sha256 ?? ''} isDemo={r.is_demo} stepUpOk={stepUpFresh(s)} />
            <form action={backToDraftAction}><input type="hidden" name="contract_id" value={c.id} /><button className="btn-quiet">‹ Entwurf ändern</button></form>
          </div>
        )}

        {r?.status === 'APPROVED' && (
          <div className="grid gap-4">
            <p className={`notice ${r.is_demo ? 'notice-info' : 'notice-good'}`}>
              {r.is_demo ? 'Simulierte Freigabe' : 'Freigegeben'} am {freshApproval ? formatDateTime(freshApproval.created_at, tz) : '–'} (mit Authenticator bestätigt).
            </p>
            {!r.is_demo && (
              <Link href={`/leben/vertraege/${c.id}/brief`} className="btn btn-secondary w-full">Brief zum Ausdrucken öffnen</Link>
            )}
            <SendForm contractId={c.id} isDemo={r.is_demo} channel={CHANNEL_LABEL[r.dispatch_channel ?? ''] ?? ''} />
            <form action={backToDraftAction}><input type="hidden" name="contract_id" value={c.id} /><button className="btn-quiet">Freigabe zurückziehen und Entwurf ändern</button></form>
          </div>
        )}

        {r && ['SENT', 'DELIVERY_EVIDENCE', 'CONFIRMED', 'CLOSED'].includes(r.status) && (
          <div className="grid gap-4">
            {msgs.filter((m) => m.status === 'dispatched' || m.status === 'delivered').map((m) => (
              <div key={m.id} className={`card ${m.mode === 'simulated' ? 'border-dashed' : ''}`}>
                <p className="eyebrow">{m.mode === 'simulated' ? 'Versandbeleg – SIMULIERT' : 'Versandbeleg'}</p>
                <p className="mt-1 font-semibold">{m.mode === 'simulated' ? 'Es wurde nichts verschickt.' : `Verschickt (${m.channel === 'postal' ? 'Post' : m.channel})`}</p>
                <p className="text-sm text-muted">{m.dispatched_at ? formatDateTime(m.dispatched_at, tz) : ''} · Prüfsumme {m.body_sha256.slice(0, 12)}…</p>
              </div>
            ))}
            {r.status === 'SENT' && (
              <div className="card grid gap-3">
                <p className="font-semibold">Jarvis wartet auf den Zugangsnachweis.</p>
                <p className="text-sm text-muted">{r.checks?.wetSignature ? 'Bei Einwurf-Einschreiben: Auslieferungsbeleg bei der Deutschen Post anfordern – der Online-Status allein reicht nicht.' : 'Eingangsbestätigung des Anbieters abwarten und hochladen.'}</p>
                <form action={advanceAction}><input type="hidden" name="contract_id" value={c.id} /><input type="hidden" name="to" value="DELIVERY_EVIDENCE" />
                  <button className="btn btn-primary w-full">Zugangsnachweis liegt vor</button></form>
              </div>
            )}
            {r.status === 'DELIVERY_EVIDENCE' && (
              <div className="card grid gap-3">
                <p className="font-semibold">Warte auf schriftliche Bestätigung.</p>
                <p className="text-sm text-muted">Sobald der Vertragspartner das Vertragsende bestätigt, hier weiter. Ohne Antwort erinnert Jarvis dich ans Nachhaken.</p>
                <form action={advanceAction}><input type="hidden" name="contract_id" value={c.id} /><input type="hidden" name="to" value="CONFIRMED" />
                  <button className="btn btn-primary w-full">Bestätigung erhalten</button></form>
                <form action={advanceAction}><input type="hidden" name="contract_id" value={c.id} /><input type="hidden" name="to" value="DISPUTED" />
                  <button className="btn-quiet">Gegenseite widerspricht</button></form>
              </div>
            )}
            {(r.status === 'CONFIRMED' || r.status === 'CLOSED') && (
              <div className="card grid gap-3">
                <p className="font-semibold">{r.status === 'CLOSED' ? '✓ Abgeschlossen' : 'Zum Abschluss fehlt noch:'}</p>
                <ul className="grid gap-2">
                  {Object.entries(r.closure_checklist).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between gap-2">
                      <span className={v !== 'open' ? 'text-muted line-through' : ''}>{CLOSURE_LABEL[k] ?? k}</span>
                      {r.status === 'CONFIRMED' && (
                        <form action={closureItemAction} className="flex gap-1">
                          <input type="hidden" name="contract_id" value={c.id} /><input type="hidden" name="key" value={k} />
                          <button name="value" value="done" aria-pressed={v === 'done'} className={`chip px-3 py-1.5 ${v === 'done' ? 'chip-verified' : 'chip-detected'}`}>erledigt</button>
                          <button name="value" value="not_applicable" aria-pressed={v === 'not_applicable'} className={`chip px-3 py-1.5 ${v === 'not_applicable' ? 'chip-verified' : 'chip-detected'}`}>entfällt</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
                {r.status === 'CONFIRMED' && <CloseForm contractId={c.id} />}
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

function Fact({ label, value, c }: { label: string; value: string | null; c?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line pb-2">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold">{value ?? <span className="font-normal text-muted">unbekannt – bitte prüfen</span>}{value && c ? <> <Certainty value={c} /></> : null}</span>
    </div>
  );
}

function Checks({ checks }: { checks: R['checks'] }) {
  const items = checks?.items ?? [];
  return (
    <div className="grid gap-2">
      {(checks?.blockers ?? []).map((b) => <p key={b} className="notice notice-bad">{b}</p>)}
      {(checks?.missing ?? []).length > 0 && <p className="notice notice-warn">Noch offen: {checks.missing!.join(', ')}</p>}
      <details className="card">
        <summary className="cursor-pointer font-semibold text-sea">Rechtliche und Versand-Prüfpunkte ({items.length})</summary>
        <ul className="mt-3 grid gap-3">
          {items.map((it) => (
            <li key={it.id}>
              <p className="font-semibold">{it.state === 'ok' ? '✓' : it.state === 'open' ? '○' : '!'} {it.label}</p>
              <p className="text-sm text-muted">{it.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Hinweise, keine Rechtsberatung. Quellen: docs/RESEARCH_DE_UAE.md.</p>
      </details>
    </div>
  );
}

function Letter({ subject, body }: { subject: string | null; body: string }) {
  return (
    <div className="card whitespace-pre-wrap bg-white font-serif text-[0.98rem] leading-relaxed text-black">
      {body.split(/(\[BITTE ERGÄNZEN:[^\]]*\])/).map((part, i) => part.startsWith('[BITTE ERGÄNZEN') ? <mark key={i} className="rounded bg-yellow-200 px-1">{part}</mark> : <span key={i}>{part}</span>)}
      <span className="sr-only">Betreff: {subject}</span>
    </div>
  );
}
