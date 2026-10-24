'use client';
import { useActionState } from 'react';
import { saveSettingsAction } from './actions';
import { ErrorNote, OkNote, Submit } from '@/components/form';

const ZONES = ['Europe/Berlin', 'Asia/Dubai'];
const CH: Array<[string, string, string]> = [
  ['email', 'E-Mail', 'an deine eigene Adresse'],
  ['push', 'Push-Nachricht', 'aufs iPhone (geplant)'],
  ['sms', 'SMS', 'nur bei kritischen Fristen (geplant)'],
  ['voice', 'Anruf', 'nur kritisch, nach Stufe 3 (geplant)'],
];

export function SettingsForm({ profile, channels }: {
  profile: { display_name: string; timezone: string; quiet_hours_start: string; quiet_hours_end: string; max_notifications_per_day: number };
  channels: string[];
}) {
  const [state, action] = useActionState(saveSettingsAction, undefined);
  return (
    <form action={action} className="card grid gap-4">
      <div><label className="label" htmlFor="display_name">Wie soll ich dich nennen?</label>
        <input id="display_name" name="display_name" defaultValue={profile.display_name} maxLength={60} className="field" /></div>
      <div><label className="label" htmlFor="timezone">Zeitzone</label>
        <select id="timezone" name="timezone" defaultValue={profile.timezone} className="field">
          {ZONES.map((z) => <option key={z} value={z}>{z === 'Asia/Dubai' ? 'Dubai' : 'Deutschland'} ({z})</option>)}
        </select></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="qs">Ruhe ab</label><input id="qs" name="quiet_hours_start" type="time" defaultValue={profile.quiet_hours_start} className="field" /></div>
        <div><label className="label" htmlFor="qe">Ruhe bis</label><input id="qe" name="quiet_hours_end" type="time" defaultValue={profile.quiet_hours_end} className="field" /></div>
      </div>
      <div><label className="label" htmlFor="max">Höchstens so viele Erinnerungen pro Tag</label>
        <input id="max" name="max_notifications_per_day" type="number" min={0} max={20} defaultValue={profile.max_notifications_per_day} className="field" /></div>
      <fieldset className="grid gap-2">
        <legend className="label">Wie darf ich dich erinnern? (In der App immer.)</legend>
        {CH.map(([k, l, d]) => (
          <label key={k} className="flex items-center gap-3"><input type="checkbox" name={`ch_${k}`} defaultChecked={channels.includes(k)} className="size-5" />
            <span><strong>{l}</strong> <span className="text-sm text-muted">– {d}</span></span></label>
        ))}
      </fieldset>
      <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
      <Submit>Speichern</Submit>
    </form>
  );
}
