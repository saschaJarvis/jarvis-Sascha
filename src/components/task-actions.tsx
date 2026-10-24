'use client';
import { useActionState } from 'react';
import { transitionAction } from '@/app/(app)/aufgaben/actions';
import { ErrorNote, OkNote, Submit } from './form';

export function TransitionButton({ id, version, to, label, big, variant = 'primary' }:
  { id: string; version: number; to: string; label: string; big?: boolean; variant?: 'primary' | 'secondary' }) {
  const [state, action] = useActionState(transitionAction, undefined);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="to" value={to} />
      <Submit className={`btn btn-${variant} w-full ${big ? 'min-h-14 text-lg' : ''}`}>{label}</Submit>
      <ErrorNote error={state?.error} />
      <OkNote message={state?.ok} />
    </form>
  );
}
