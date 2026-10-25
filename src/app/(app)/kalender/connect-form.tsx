'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { addCalendarAction } from './actions';
import { ErrorNote, OkNote, Submit } from '@/components/form';

export function ConnectCalendarForm() {
  const [state, action] = useActionState(addCalendarAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <div>
        <label className="label" htmlFor="cal-url">Kalender-Link</label>
        <input id="cal-url" name="url" required inputMode="url" autoComplete="off" spellCheck={false} className="field mono text-sm"
          placeholder="webcal://p…-caldav.icloud.com/published/2/…" />
      </div>
      <div>
        <label className="label" htmlFor="cal-name">Name in Jarvis</label>
        <input id="cal-name" name="name" maxLength={60} defaultValue="iPhone" className="field" />
      </div>
      <Submit>Kalender verbinden</Submit>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
    </form>
  );
}

/** Aufklappbereich, der nach dem Verbinden offen bleibt (sonst wäre die Erfolgsmeldung verdeckt). */
export function ConnectSection({ initialOpen, title, children }: { initialOpen: boolean; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <details className="card" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold text-sea">{title}</summary>
      {children}
    </details>
  );
}
