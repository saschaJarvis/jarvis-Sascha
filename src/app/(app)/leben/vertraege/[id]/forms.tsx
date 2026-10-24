'use client';
import { useActionState, useState } from 'react';
import { approveAction, buildDraftAction, closeAction, saveContractFactsAction, saveDraftAction, sendAction } from '../actions';
import { ErrorNote, OkNote, Submit } from '@/components/form';

export function FactsForm({ c }: { c: { id: string; counterparty_name: string | null; counterparty_address: string | null; contract_number: string | null; earliest_end_date: string | null; notice_period_text: string | null } }) {
  const [state, action] = useActionState(saveContractFactsAction, undefined);
  const d = c.earliest_end_date ? new Date(c.earliest_end_date).toISOString().slice(0, 10) : '';
  return (
    <form action={action} className="mt-3 grid gap-3">
      <input type="hidden" name="id" value={c.id} />
      <div><label className="label" htmlFor="cp">Vertragspartner (wie im Vertrag)</label><input id="cp" name="counterparty_name" defaultValue={c.counterparty_name ?? ''} className="field" /></div>
      <div><label className="label" htmlFor="ca">Anschrift</label><textarea id="ca" name="counterparty_address" rows={2} defaultValue={c.counterparty_address ?? ''} className="field" /></div>
      <div><label className="label" htmlFor="cn">Vertragsnummer</label><input id="cn" name="contract_number" defaultValue={c.contract_number ?? ''} className="field" /></div>
      <div><label className="label" htmlFor="np">Kündigungsfrist – wörtlich aus dem Vertrag</label><textarea id="np" name="notice_period_text" rows={2} defaultValue={c.notice_period_text ?? ''} className="field" /></div>
      <div><label className="label" htmlFor="ed">Frühestes Vertragsende (nur wenn sicher belegt)</label><input id="ed" name="earliest_end_date" type="date" defaultValue={d} className="field" /></div>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
      <Submit className="btn btn-secondary">Speichern</Submit>
    </form>
  );
}

export function DraftStarter({ contractId, category, defaults }: { contractId: string; category: string; defaults: { sender_name: string } }) {
  const [state, action] = useActionState(buildDraftAction, undefined);
  const lease = ['residential_lease', 'commercial_lease', 'storage'].includes(category);
  return (
    <form action={action} className="card grid gap-3">
      <input type="hidden" name="contract_id" value={contractId} />
      <p className="font-semibold">Ein paar Angaben für den Brief</p>
      <div><label className="label" htmlFor="sn">Dein Name (bzw. Firma, falls die Firma Mieter ist)</label><input id="sn" name="sender_name" defaultValue={defaults.sender_name} className="field" /></div>
      <div><label className="label" htmlFor="sa">Deine Anschrift</label><input id="sa" name="sender_address" className="field" /></div>
      <div><label className="label" htmlFor="sc">Ort</label><input id="sc" name="sender_city" className="field" placeholder="Mainz" /></div>
      {lease && <div><label className="label" htmlFor="oa">Adresse des Objekts</label><input id="oa" name="object_address" className="field" /></div>}
      {category === 'commercial_lease' && (
        <fieldset><legend className="label">Ist der Vertrag befristet?</legend>
          <div className="grid grid-cols-3 gap-1">
            {[['yes', 'ja'], ['no', 'nein'], ['', 'weiß nicht']].map(([v, l]) => (
              <label key={l} className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-line text-sm has-[:checked]:border-sea has-[:checked]:bg-sea-soft">
                <input type="radio" name="fixed_term" value={v} defaultChecked={v === ''} className="sr-only" />{l}</label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="text-sm text-muted">Leere Felder bleiben im Entwurf als markierte Lücke stehen.</p>
      <ErrorNote error={state?.error} />
      <Submit>Entwurf erstellen</Submit>
    </form>
  );
}

export function DraftEditor({ contractId, subject, body, channel, isDemo, placeholders, channels }:
  { contractId: string; subject: string; body: string; channel: string; isDemo: boolean; placeholders: boolean; channels: Record<string, string> }) {
  const [state, action] = useActionState(saveDraftAction, undefined);
  return (
    <form action={action} className="card mt-3 grid gap-3">
      <input type="hidden" name="contract_id" value={contractId} />
      <div><label className="label" htmlFor="ds">Betreff</label><input id="ds" name="draft_subject" defaultValue={subject} className="field" /></div>
      <div><label className="label" htmlFor="db">Entwurf</label>
        <textarea id="db" name="draft_body" defaultValue={body} rows={18} className="field font-serif text-[0.95rem] leading-relaxed" /></div>
      <div><label className="label" htmlFor="dc">Versandweg</label>
        <select id="dc" name="dispatch_channel" defaultValue={channel} className="field">{Object.entries(channels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      {placeholders && <p className="notice notice-warn">Noch „[BITTE ERGÄNZEN …]“-Stellen im Text.{isDemo ? ' Im Beispiel darfst du trotzdem weiter.' : ' Erst ausfüllen, dann zur Freigabe.'}</p>}
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
      <div className="grid grid-cols-2 gap-2">
        <Submit className="btn btn-secondary" name="intent" value="save">Speichern</Submit>
        <Submit className="btn btn-primary" name="intent" value="review">Zur Freigabe</Submit>
      </div>
    </form>
  );
}

export function ApproveForm({ contractId, sha, isDemo, stepUpOk }: { contractId: string; sha: string; isDemo: boolean; stepUpOk: boolean }) {
  const [state, action] = useActionState(approveAction, undefined);
  const [checked, setChecked] = useState(false);
  return (
    <form action={action} className="card grid gap-3 border-2 border-sea">
      <input type="hidden" name="contract_id" value={contractId} />
      <input type="hidden" name="sha" value={sha} />
      <label className="flex items-start gap-3">
        <input type="checkbox" name="confirm" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 size-6 shrink-0" />
        <span>Ich habe den Entwurf und die Prüfpunkte gelesen und gebe ihn {isDemo ? <strong>für einen simulierten Versand</strong> : 'zum Versand'} frei.</span>
      </label>
      <p className="text-sm text-muted">{stepUpOk ? 'Dein Authenticator-Code ist noch frisch.' : 'Danach fragt Jarvis nach einem frischen Authenticator-Code.'} Die Freigabe gilt nur für genau diesen Text (Prüfsumme {sha.slice(0, 12)}…).</p>
      <ErrorNote error={state?.error} />
      <Submit disabled={!checked}>{isDemo ? 'Simuliert freigeben' : 'Freigeben'}</Submit>
    </form>
  );
}

export function SendForm({ contractId, isDemo, channel }: { contractId: string; isDemo: boolean; channel: string }) {
  const [state, action] = useActionState(sendAction, undefined);
  return (
    <form action={action} className="card grid gap-3">
      <input type="hidden" name="contract_id" value={contractId} />
      {isDemo ? (
        <p>Im Beispiel wird <strong>nichts</strong> verschickt. Der Knopf erzeugt nur einen als „simuliert“ markierten Beleg.</p>
      ) : (
        <>
          <p>Jarvis verschickt Kündigungen nicht selbst. Drucke den Brief, unterschreibe ihn und schicke ihn per <strong>{channel}</strong>.</p>
          <label className="flex items-start gap-3"><input type="checkbox" name="self_sent" className="mt-1 size-6 shrink-0" /><span>Ich habe den unterschriebenen Brief abgeschickt.</span></label>
        </>
      )}
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
      <Submit>{isDemo ? 'Simuliert senden' : 'Versand verbuchen'}</Submit>
    </form>
  );
}

export function CloseForm({ contractId }: { contractId: string }) {
  const [state, action] = useActionState(closeAction, undefined);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="contract_id" value={contractId} />
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
      <Submit>Vorgang abschließen</Submit>
    </form>
  );
}
