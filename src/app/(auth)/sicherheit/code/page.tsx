import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth';
import { TotpForm } from './totp-form';

export default async function Page({ searchParams }: { searchParams: Promise<{ weiter?: string; grund?: string }> }) {
  const s = await getSession();
  if (!s) redirect('/anmelden');
  if (!s.totpEnabled) redirect('/sicherheit/einrichten');
  const { weiter, grund } = await searchParams;
  return (
    <div className="card space-y-4">
      <h1 className="text-xl font-bold">{grund ? 'Kurz bestätigen' : 'Code aus der Authenticator-App'}</h1>
      <p className="text-muted">
        {grund ? `${grund} Dafür brauche ich einen frischen Code.` : 'Öffne deine Authenticator-App und gib den 6-stelligen Code für „Jarvis" ein.'}
      </p>
      <TotpForm next={weiter ?? '/'} />
    </div>
  );
}
