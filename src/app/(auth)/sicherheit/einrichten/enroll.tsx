'use client';
import { useEffect, useRef, useState } from 'react';
import { startEnrollmentAction } from '../../actions';
import { TotpForm } from '../code/totp-form';
import { ErrorNote } from '@/components/form';

type E = { secret?: string; factorId?: string; uri?: string; qr?: string; error?: string };

export function Enroll() {
  const [e, setE] = useState<E | null>(null);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;            // genau einmal – sonst entstünde ein neues Geheimnis
    started.current = true;
    startEnrollmentAction().then(setE);
  }, []);
  if (!e) return <p className="text-muted" aria-live="polite">Code wird erzeugt …</p>;
  if (e.error) return <ErrorNote error={e.error} />;
  return (
    <>
      <img src={e.qr} alt="QR-Code für die Authenticator-App" width={240} height={240} className="mx-auto rounded-lg bg-white p-2" />
      <p className="text-center font-mono text-sm break-all" data-testid="totp-secret" data-secret={e.secret}>{e.secret?.match(/.{1,4}/g)?.join(' ')}</p>
      <a className="btn btn-secondary w-full" href={e.uri}>Auf diesem iPhone öffnen</a>
      <div>
        <p className="eyebrow">Schritt 2 von 2</p>
        <p className="mb-3 text-muted">Gib den Code ein, den die App jetzt zeigt.</p>
        <TotpForm next="/willkommen" label="Einrichten abschließen" factorId={e.factorId} />
      </div>
    </>
  );
}
