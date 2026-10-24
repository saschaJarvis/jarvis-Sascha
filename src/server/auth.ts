import 'server-only';
import { redirect } from 'next/navigation';
import type { Claims } from './db';
import * as local from './auth-local';
import * as supa from './auth-supabase';

/**
 * Anmeldung – zwei austauschbare Anbieter mit identischer Session-Form:
 *  - AUTH_PROVIDER=supabase (Produktion): Supabase Auth, TOTP-MFA, JWT mit aal/amr
 *  - sonst lokal (Entwicklung/Tests): Passwort + TOTP gegen local_auth-Tabellen
 * Die Datenbank prüft in beiden Fällen dieselben Claims (RLS, MFA-Pflicht, Step-up).
 */

export interface Session {
  userId: string;
  email: string;
  aal: 'aal1' | 'aal2';
  totpEnabled: boolean;
  mfaAt: Date | null;
  claims: Claims;
}

export interface Enrollment { secret: string; factorId: string; uri?: string }

const STEP_UP_MINUTES = 10;
export const usingSupabase = () => process.env.AUTH_PROVIDER === 'supabase';
const p = () => (usingSupabase() ? supa : local);

export const getSession = (): Promise<Session | null> => p().getSession();
export const signUp = (email: string, password: string) => p().signUp(email, password);
export const signIn = (email: string, password: string) => p().signIn(email, password);
export const signOut = () => p().signOut();
export const beginTotpEnrollment = (s: Session): Promise<Enrollment> => p().beginTotpEnrollment(s);
export const verifyTotpForSession = (code: string, factorId?: string) => p().verifyTotpForSession(code, factorId);

/** Für alle App-Seiten und Server Actions: angemeldet UND zweiter Faktor bestätigt. */
export async function requireUser(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/anmelden');
  if (!s.totpEnabled) redirect('/sicherheit/einrichten');
  if (s.aal !== 'aal2') redirect('/sicherheit/code');
  return s;
}

export function stepUpFresh(s: Session): boolean {
  return !!s.mfaAt && Date.now() - s.mfaAt.getTime() < STEP_UP_MINUTES * 60_000;
}
