'use client';
import { useActionState } from 'react';
import { loginAction, signupAction } from '../actions';
import { ErrorNote, Submit } from '@/components/form';

export function LoginForm() {
  const [state, action] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="field" /></div>
      <div><label className="label" htmlFor="password">Passwort</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field" /></div>
      <ErrorNote error={state?.error} />
      <Submit className="btn btn-primary w-full">Weiter</Submit>
    </form>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signupAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="email">E-Mail</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="field" /></div>
      <div><label className="label" htmlFor="password">Passwort (mind. 12 Zeichen)</label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required className="field" /></div>
      <div><label className="label" htmlFor="password2">Passwort wiederholen</label>
        <input id="password2" name="password2" type="password" autoComplete="new-password" minLength={12} required className="field" /></div>
      <ErrorNote error={state?.error} />
      <Submit className="btn btn-primary w-full">Konto anlegen</Submit>
    </form>
  );
}
