'use client';
import { useActionState } from 'react';
import { totpAction } from '../../actions';
import { ErrorNote, Submit } from '@/components/form';

export function TotpForm({ next, label = 'Bestätigen' }: { next: string; label?: string }) {
  const [state, action] = useActionState(totpAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="label" htmlFor="code">6-stelliger Code</label>
      <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
        required autoFocus className="field text-center text-2xl tracking-[0.4em]" />
      <ErrorNote error={state?.error} />
      <Submit className="btn btn-primary w-full">{label}</Submit>
    </form>
  );
}
