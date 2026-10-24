'use client';
import { useActionState } from 'react';
import { newTaskAction } from '../actions';
import { ErrorNote, Submit } from '@/components/form';

export function NewTaskForm() {
  const [state, action] = useActionState(newTaskAction, undefined);
  return (
    <form action={action} className="card grid gap-4">
      <div><label className="label" htmlFor="title">Was ist zu tun?</label>
        <input id="title" name="title" required minLength={2} maxLength={300} className="field" /></div>
      <div><label className="label" htmlFor="next_step">Erster kleiner Schritt (optional)</label>
        <input id="next_step" name="next_step" maxLength={300} className="field" placeholder="z. B. Vertrag heraussuchen" /></div>
      <div><label className="label" htmlFor="due">Bis wann? (optional)</label>
        <input id="due" name="due" type="datetime-local" className="field" /></div>
      <fieldset>
        <legend className="label">Wie dringend?</legend>
        <div className="grid grid-cols-4 gap-1">
          {['locker', 'normal', 'wichtig', 'kritisch'].map((l, i) => (
            <label key={l} className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-line text-sm has-[:checked]:border-sea has-[:checked]:bg-sea-soft">
              <input type="radio" name="urgency" value={i} defaultChecked={i === 1} className="sr-only" />{l}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-3"><input type="checkbox" name="evidence" className="size-5" /> Braucht einen Nachweis (z. B. Bestätigung)</label>
      <ErrorNote error={state?.error} />
      <Submit>Anlegen</Submit>
    </form>
  );
}
