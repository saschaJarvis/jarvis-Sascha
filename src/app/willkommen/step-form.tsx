'use client';
import { useActionState } from 'react';
import { onboardingStepAction } from './actions';
import { ErrorNote, Submit } from '@/components/form';

type P = { display_name: string; timezone: string; moving_date: string; quiet_hours_start: string; quiet_hours_end: string };

export function StepForm({ step, profile }: { step: number; profile: P }) {
  const [state, action] = useActionState(onboardingStepAction, undefined);
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="step" value={step} />
      {step === 1 && (
        <>
          <h1 className="text-2xl font-bold">Hallo! Ich bin Jarvis.</h1>
          <p className="text-muted">Ich halte deine Fristen, Rechnungen und den Umzug im Blick – und zeige dir immer nur den nächsten Schritt. Vier kurze Fragen.</p>
          <div><label className="label" htmlFor="n">Wie soll ich dich nennen?</label><input id="n" name="display_name" defaultValue={profile.display_name} className="field" autoFocus /></div>
          <div><label className="label" htmlFor="tz">Wo bist du gerade?</label>
            <select id="tz" name="timezone" defaultValue={profile.timezone} className="field">
              <option value="Europe/Berlin">Deutschland</option><option value="Asia/Dubai">Dubai</option>
            </select></div>
        </>
      )}
      {step === 2 && (
        <>
          <h1 className="text-2xl font-bold">Wann ziehst du um?</h1>
          <p className="text-muted">Ein ungefähres Datum reicht nicht – lieber leer lassen, bis es feststeht.</p>
          <div><label className="label" htmlFor="md">Umzugsdatum</label><input id="md" name="moving_date" type="date" defaultValue={profile.moving_date} className="field" /></div>
          <label className="flex items-center gap-3"><input type="checkbox" name="unknown" className="size-5" defaultChecked={!profile.moving_date} /> Weiß ich noch nicht</label>
        </>
      )}
      {step === 3 && (
        <>
          <h1 className="text-2xl font-bold">Wann soll ich still sein?</h1>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="qs">Ruhe ab</label><input id="qs" name="quiet_hours_start" type="time" defaultValue={profile.quiet_hours_start} className="field" /></div>
            <div><label className="label" htmlFor="qe">bis</label><input id="qe" name="quiet_hours_end" type="time" defaultValue={profile.quiet_hours_end} className="field" /></div>
          </div>
          <label className="flex items-start gap-3"><input type="checkbox" name="ch_email" className="mt-1 size-5" />
            <span>Wichtige Erinnerungen auch per E-Mail an mich schicken. <span className="text-sm text-muted">(Jederzeit änderbar. Höchstens 4 am Tag, nie nachts.)</span></span></label>
        </>
      )}
      {step === 4 && (
        <>
          <h1 className="text-2xl font-bold">Womit starten?</h1>
          <label className="card flex cursor-pointer items-start gap-3 has-[:checked]:border-sea">
            <input type="radio" name="demo" value="yes" defaultChecked className="mt-1 size-5" />
            <span><strong>Mit Beispielen</strong><span className="block text-sm text-muted">Ein paar Umzugsaufgaben und die Beispiel-Kündigung „Büromietvertrag Mainz“ – alle als BEISPIEL markiert, nichts davon ist echt.</span></span>
          </label>
          <label className="card flex cursor-pointer items-start gap-3 has-[:checked]:border-sea">
            <input type="radio" name="demo" value="no" className="mt-1 size-5" />
            <span><strong>Leer</strong><span className="block text-sm text-muted">Du trägst selbst ein, was ansteht.</span></span>
          </label>
        </>
      )}
      <ErrorNote error={state?.error} />
      <Submit className="btn btn-primary w-full">{step === 4 ? 'Los geht’s' : 'Weiter'}</Submit>
    </form>
  );
}
