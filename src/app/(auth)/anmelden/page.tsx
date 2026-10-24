import { LoginForm, SignupForm } from './forms';

export default async function Page({ searchParams }: { searchParams: Promise<{ neu?: string }> }) {
  const { neu } = await searchParams;
  const signupAllowed = process.env.ALLOW_SIGNUP === 'true';
  const showSignup = signupAllowed && neu === '1';
  return (
    <div className="card space-y-5">
      <h1 className="text-xl font-bold">{showSignup ? 'Konto anlegen' : 'Anmelden'}</h1>
      {showSignup ? <SignupForm /> : <LoginForm />}
      {signupAllowed && (
        <p className="text-sm text-muted">
          {showSignup ? <a className="text-sea underline" href="/anmelden">Ich habe schon ein Konto</a>
            : <a className="text-sea underline" href="/anmelden?neu=1">Neues Konto anlegen</a>}
        </p>
      )}
      <p className="text-xs text-muted">Nach dem Passwort fragt Jarvis immer nach dem Code aus deiner Authenticator-App.</p>
    </div>
  );
}
