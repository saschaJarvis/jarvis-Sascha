import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth';
import { Enroll } from './enroll';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const s = await getSession();
  if (!s) redirect('/anmelden');
  if (s.totpEnabled) redirect(s.aal === 'aal2' ? '/' : '/sicherheit/code');
  return (
    <div className="card space-y-5">
      <div>
        <p className="eyebrow">Schritt 1 von 2</p>
        <h1 className="text-xl font-bold">Authenticator verbinden</h1>
        <p className="mt-1 text-muted">Jarvis schützt deine Unterlagen mit einem zweiten Faktor. Das ist Pflicht.</p>
      </div>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Öffne auf dem iPhone die App <strong>Passwörter</strong> (oder eine andere Authenticator-App).</li>
        <li>Scanne diesen Code – oder tippe auf „Auf diesem iPhone öffnen“.</li>
      </ol>
      <Enroll />
    </div>
  );
}
