'use client';
import { useActionState, useEffect, useRef } from 'react';
import { addWalletAction } from './actions';
import { ErrorNote, OkNote, Submit } from '@/components/form';

export function AddWalletForm() {
  const [state, action] = useActionState(addWalletAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <div>
        <label className="label" htmlFor="w-addr">Öffentliche XRP-Adresse</label>
        <input id="w-addr" name="address" required autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={120}
          className="field mono text-sm" placeholder="r…" />
        <p className="mt-1 text-xs text-muted">In Ledger Live: XRP-Konto → „Empfangen“ → Adresse kopieren.</p>
      </div>
      <div>
        <label className="label" htmlFor="w-label">Bezeichnung</label>
        <input id="w-label" name="label" maxLength={40} defaultValue="Ledger" className="field" />
      </div>
      <Submit>Adresse hinzufügen</Submit>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
    </form>
  );
}
