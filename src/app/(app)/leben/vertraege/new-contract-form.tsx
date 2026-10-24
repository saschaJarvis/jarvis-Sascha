'use client';
import { useActionState } from 'react';
import { newContractAction } from './actions';
import { ErrorNote, Submit } from '@/components/form';

export function NewContractForm({ labels }: { labels: Record<string, string> }) {
  const [state, action] = useActionState(newContractAction, undefined);
  return (
    <form action={action} className="card grid gap-3">
      <div><label className="label" htmlFor="cname">Name</label><input id="cname" name="name" required minLength={2} className="field" placeholder="z. B. Lagerraum Mombach" /></div>
      <div><label className="label" htmlFor="ccat">Art</label>
        <select id="ccat" name="category" className="field" defaultValue="other">{Object.entries(labels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <ErrorNote error={state?.error} />
      <Submit>Anlegen</Submit>
    </form>
  );
}
