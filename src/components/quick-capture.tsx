'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { captureAction } from '@/app/(app)/aufgaben/actions';
import { ErrorNote, OkNote, Submit } from './form';

export function QuickCapture({ bare = false }: { bare?: boolean }) {
  const [state, action] = useActionState(captureAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [idem, setIdem] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (state?.ok) { formRef.current?.reset(); setIdem(crypto.randomUUID()); }
  }, [state]);
  return (
    <form ref={formRef} action={action} className={`${bare ? '' : 'card '}grid gap-3`}>
      <input type="hidden" name="idem" value={idem} />
      <label htmlFor="capture" className="sr-only">Was soll ich mir merken?</label>
      <textarea id="capture" name="text" rows={2} maxLength={500} required className="field resize-none"
        placeholder="z. B. „Morgen um 10 Uhr Steuerberater anrufen“" />
      <p className="text-xs text-muted">Tipp: Auf dem iPhone mit dem Mikrofon der Tastatur diktieren.</p>
      <Submit className="btn btn-primary">Merken</Submit>
      <ErrorNote error={state?.error} />
      <OkNote message={state?.ok} />
    </form>
  );
}
