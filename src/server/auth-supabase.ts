import 'server-only';
import { headers } from 'next/headers';
import { supabaseUser } from './supabase';
import type { Session, Enrollment } from './auth';

/**
 * Supabase Auth: Passwort + TOTP-Faktor. Die JWT-Claims (sub, aal, amr) gehen unverändert an die
 * Datenbank – dieselben Policies wie lokal greifen (aal2-Pflicht, Step-up über amr-Zeitstempel).
 */

const de = (msg: string | undefined): string => {
  const m = (msg ?? '').toLowerCase();
  if (m.includes('invalid login')) return 'E-Mail oder Passwort stimmt nicht.';
  if (m.includes('email not confirmed')) return 'Bitte zuerst den Bestätigungslink in deiner E-Mail öffnen.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Diese E-Mail ist bereits registriert.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Zu viele Versuche. Bitte kurz warten.';
  if (m.includes('invalid totp') || m.includes('invalid code')) return 'Der Code stimmt nicht. Bitte den aktuellen Code aus der Authenticator-App eingeben.';
  if (m.includes('password')) return 'Das Passwort erfüllt die Anforderungen nicht (mind. 12 Zeichen).';
  return 'Das hat nicht geklappt. Bitte erneut versuchen.';
};

export async function getSession(): Promise<Session | null> {
  const sb = await supabaseUser();
  const { data, error } = await sb.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const c = data.claims as { sub: string; email?: string; aal?: string; amr?: Array<{ method: string; timestamp: number }> };
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  const amr = c.amr ?? [];
  const totpTimes = amr.filter((a) => a.method === 'totp').map((a) => a.timestamp);
  const level = c.aal === 'aal2' ? 'aal2' : 'aal1';
  return {
    userId: c.sub,
    email: c.email ?? '',
    aal: level,
    totpEnabled: aal?.nextLevel === 'aal2' || level === 'aal2',
    mfaAt: totpTimes.length ? new Date(Math.max(...totpTimes) * 1000) : null,
    claims: { sub: c.sub, role: 'authenticated', aal: level, amr },
  };
}

export async function signUp(email: string, password: string): Promise<void> {
  if (process.env.ALLOW_SIGNUP !== 'true') throw new Error('Registrierung ist deaktiviert.');
  if (password.length < 12) throw new Error('Passwort muss mindestens 12 Zeichen haben');
  const sb = await supabaseUser();
  const { data, error } = await sb.auth.signUp({
    email: email.trim().toLowerCase(), password,
    options: { emailRedirectTo: `${await origin()}/auth/bestaetigen` },
  });
  if (error) throw new Error(de(error.message));
  if (!data.session) throw new Error('Fast geschafft: Bitte öffne den Bestätigungslink, den wir dir per E-Mail geschickt haben.');
}

async function origin(): Promise<string> {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  return `${h.get('x-forwarded-proto') ?? 'https'}://${host}`;
}

export async function signIn(email: string, password: string): Promise<void> {
  const sb = await supabaseUser();
  const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(de(error.message));
}

export async function signOut(): Promise<void> {
  const sb = await supabaseUser();
  await sb.auth.signOut();
}

export async function beginTotpEnrollment(s: Session): Promise<Enrollment> {
  if (s.totpEnabled) throw new Error('Authenticator ist bereits eingerichtet.');
  const sb = await supabaseUser();
  // Halbfertige (nicht bestätigte) Faktoren entfernen – Geheimnis ist danach nicht mehr abrufbar
  const { data: list } = await sb.auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.factor_type === 'totp' && f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Jarvis ${new Date().toISOString().slice(0, 10)}` });
  if (error || !data) throw new Error(de(error?.message));
  return { secret: data.totp.secret, factorId: data.id, uri: data.totp.uri };
}

export async function verifyTotpForSession(code: string, factorId?: string): Promise<void> {
  const sb = await supabaseUser();
  let id = factorId && factorId !== 'local' ? factorId : undefined;
  if (!id) {
    const { data } = await sb.auth.mfa.listFactors();
    id = data?.totp?.[0]?.id;
  }
  if (!id) throw new Error('Authenticator noch nicht eingerichtet.');
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: id, code: code.replace(/\s/g, '') });
  if (error) throw new Error(de(error.message));
}
