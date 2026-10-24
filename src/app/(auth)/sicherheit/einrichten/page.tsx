import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { getSession, beginTotpEnrollment } from '@/server/auth';
import { otpauthUri } from '@/lib/totp';
import { TotpForm } from '../code/totp-form';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const s = await getSession();
  if (!s) redirect('/anmelden');
  if (s.totpEnabled) redirect(s.aal === 'aal2' ? '/' : '/sicherheit/code');
  // Geheimnis wird einmal erzeugt und bleibt bis zur Bestätigung gleich – aktiv erst nach korrektem Code.
  const secret = await beginTotpEnrollment(s);
  const uri = otpauthUri(secret, s.email);
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240 });
  const grouped = secret.match(/.{1,4}/g)?.join(' ');
  return (
    <div className="card space-y-5">
      <div>
        <p className="eyebrow">Schritt 1 von 2</p>
        <h1 className="text-xl font-bold">Authenticator verbinden</h1>
        <p className="mt-1 text-muted">Jarvis schützt deine Unterlagen mit einem zweiten Faktor. Das ist Pflicht.</p>
      </div>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Öffne auf dem iPhone die App <strong>Passwörter</strong> (oder eine andere Authenticator-App).</li>
        <li>Scanne diesen Code – oder tippe den Schlüssel ab.</li>
      </ol>
      <img src={qr} alt="QR-Code für die Authenticator-App" width={240} height={240} className="mx-auto rounded-lg bg-white p-2" />
      <p className="text-center font-mono text-sm break-all" data-testid="totp-secret" data-secret={secret}>{grouped}</p>
      <a className="btn btn-secondary w-full" href={uri}>Auf diesem iPhone öffnen</a>
      <div>
        <p className="eyebrow">Schritt 2 von 2</p>
        <p className="mb-3 text-muted">Gib den Code ein, den die App jetzt zeigt.</p>
        <TotpForm next="/willkommen" label="Einrichten abschließen" />
      </div>
    </div>
  );
}
