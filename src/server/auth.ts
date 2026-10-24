import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { withService, Claims } from './db';
import { decrypt, encrypt, hashPassword, randomToken, sha256Hex, verifyPassword } from './crypto';
import { generateSecret, verifyTotp } from '@/lib/totp';

/**
 * Lokale Anmeldung (Entwicklung/Demo): Passwort + TOTP, serverseitige Sessions.
 * In Produktion wird dieses Modul durch Supabase Auth ersetzt (gleiche Claims-Form: sub, aal, amr).
 */

const COOKIE = 'jarvis_session';
const SESSION_HOURS = 12;
const STEP_UP_MINUTES = 10;
const MAX_FAILS = 5;

export interface Session {
  userId: string;
  email: string;
  aal: 'aal1' | 'aal2';
  totpEnabled: boolean;
  mfaAt: Date | null;
  passwordAt: Date;
  claims: Claims;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  };
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const rows = await withService((q) => q<{ user_id: string; email: string; password_at: Date; mfa_at: Date | null; totp_enabled: boolean }>(
    `select s.user_id, c.email, s.password_at, s.mfa_at, c.totp_enabled
       from local_auth.sessions s join local_auth.credentials c on c.user_id = s.user_id
      where s.id_hash = $1 and s.revoked_at is null and s.expires_at > now()`, [sha256Hex(raw)]), 'owner');
  const r = rows[0];
  if (!r) return null;
  const aal = r.mfa_at ? 'aal2' : 'aal1';
  const amr = [{ method: 'password', timestamp: Math.floor(new Date(r.password_at).getTime() / 1000) }];
  if (r.mfa_at) amr.push({ method: 'totp', timestamp: Math.floor(new Date(r.mfa_at).getTime() / 1000) });
  return {
    userId: r.user_id, email: r.email, aal, totpEnabled: r.totp_enabled,
    mfaAt: r.mfa_at ? new Date(r.mfa_at) : null, passwordAt: new Date(r.password_at),
    claims: { sub: r.user_id, role: 'authenticated', aal, amr },
  };
}

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

export async function signUp(email: string, password: string): Promise<void> {
  if (process.env.ALLOW_SIGNUP !== 'true') throw new Error('Registrierung ist deaktiviert.');
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Bitte eine gültige E-Mail-Adresse eingeben.');
  const hash = await hashPassword(password);
  const id = randomUUID();
  await withService(async (q) => {
    const exists = await q('select 1 from local_auth.credentials where email = $1', [e]);
    if (exists.length) throw new Error('Diese E-Mail ist bereits registriert.');
    await q('insert into auth.users (id, email) values ($1, $2)', [id, e]);
    await q('insert into public.profiles (id) values ($1)', [id]);
    await q('insert into local_auth.credentials (user_id, email, password_hash) values ($1, $2, $3)', [id, e, hash]);
  }, 'owner');
  await createSession(id);
}

async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  await withService((q) => q(
    `insert into local_auth.sessions (id_hash, user_id, password_at, expires_at)
     values ($1, $2, now(), now() + make_interval(hours => $3))`, [sha256Hex(token), userId, SESSION_HOURS]), 'owner');
  (await cookies()).set(COOKIE, token, cookieOptions());
}

export async function signIn(email: string, password: string): Promise<void> {
  const e = email.trim().toLowerCase();
  const rows = await withService((q) => q<{ user_id: string; password_hash: string; failed_attempts: number; locked_until: Date | null }>(
    'select user_id, password_hash, failed_attempts, locked_until from local_auth.credentials where email = $1', [e]), 'owner');
  const r = rows[0];
  const generic = 'E-Mail oder Passwort stimmt nicht.';
  if (!r) { await verifyPassword(password, 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA'); throw new Error(generic); }
  if (r.locked_until && new Date(r.locked_until) > new Date()) throw new Error('Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.');
  if (!(await verifyPassword(password, r.password_hash))) {
    await withService((q) => q(
      `update local_auth.credentials set failed_attempts = failed_attempts + 1,
         locked_until = case when failed_attempts + 1 >= $2 then now() + interval '15 minutes' else locked_until end
       where user_id = $1`, [r.user_id, MAX_FAILS]), 'owner');
    throw new Error(generic);
  }
  await withService((q) => q('update local_auth.credentials set failed_attempts = 0, locked_until = null where user_id = $1', [r.user_id]), 'owner');
  await createSession(r.user_id);
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (raw) await withService((q) => q('update local_auth.sessions set revoked_at = now() where id_hash = $1', [sha256Hex(raw)]), 'owner');
  store.delete(COOKIE);
}

/** TOTP-Einrichtung: Geheimnis erzeugen (verschlüsselt speichern), aber erst nach Bestätigung aktivieren. */
export async function beginTotpEnrollment(s: Session): Promise<string> {
  if (s.totpEnabled) throw new Error('Authenticator ist bereits eingerichtet.');
  // Bereits erzeugtes, noch nicht bestätigtes Geheimnis wiederverwenden (Seite kann neu laden)
  const existing = await withService((q) => q<{ totp_secret_enc: string | null }>(
    'select totp_secret_enc from local_auth.credentials where user_id = $1 and not totp_enabled', [s.userId]), 'owner');
  if (existing[0]?.totp_secret_enc) return decrypt(existing[0].totp_secret_enc);
  const secret = generateSecret();
  await withService((q) => q('update local_auth.credentials set totp_secret_enc = $2 where user_id = $1 and not totp_enabled', [s.userId, encrypt(secret)]), 'owner');
  return secret;
}

export async function verifyTotpForSession(code: string): Promise<void> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  const s = await getSession();
  if (!s || !raw) throw new Error('Bitte erneut anmelden.');
  const rows = await withService((q) => q<{ totp_secret_enc: string | null; totp_last_counter: string | null; failed_attempts: number; locked_until: Date | null }>(
    'select totp_secret_enc, totp_last_counter, failed_attempts, locked_until from local_auth.credentials where user_id = $1', [s.userId]), 'owner');
  const r = rows[0];
  if (!r?.totp_secret_enc) throw new Error('Authenticator noch nicht eingerichtet.');
  if (r.locked_until && new Date(r.locked_until) > new Date()) throw new Error('Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.');
  const ctr = verifyTotp(decrypt(r.totp_secret_enc), code, Date.now(), { lastCounter: r.totp_last_counter ? BigInt(r.totp_last_counter) : null });
  if (ctr === null) {
    await withService((q) => q(
      `update local_auth.credentials set failed_attempts = failed_attempts + 1,
         locked_until = case when failed_attempts + 1 >= $2 then now() + interval '15 minutes' else locked_until end where user_id = $1`,
      [s.userId, MAX_FAILS]), 'owner');
    throw new Error('Der Code stimmt nicht. Bitte den aktuellen Code aus der Authenticator-App eingeben.');
  }
  await withService(async (q) => {
    await q('update local_auth.credentials set totp_enabled = true, totp_last_counter = $2, failed_attempts = 0, locked_until = null where user_id = $1', [s.userId, ctr.toString()]);
    await q('update local_auth.sessions set mfa_at = now() where id_hash = $1', [sha256Hex(raw)]);
    await q(`select app.log_audit($1, 'user', 'auth.mfa_verified', 'session', null, '{}'::jsonb)`, [s.userId]);
  }, 'owner');
}
