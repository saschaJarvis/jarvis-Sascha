'use server';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { beginTotpEnrollment, getSession, signIn, signOut, signUp, verifyTotpForSession } from '@/server/auth';
import { otpauthUri } from '@/lib/totp';

export type FormState = { error?: string } | undefined;

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/';
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    await signIn(String(fd.get('email') ?? ''), String(fd.get('password') ?? ''));
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect('/sicherheit/code');
}

export async function signupAction(_: FormState, fd: FormData): Promise<FormState> {
  const pw = String(fd.get('password') ?? '');
  if (pw !== String(fd.get('password2') ?? '')) return { error: 'Die Passwörter stimmen nicht überein.' };
  try {
    await signUp(String(fd.get('email') ?? ''), pw);
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect('/sicherheit/einrichten');
}

export async function totpAction(_: FormState, fd: FormData): Promise<FormState> {
  try {
    const factorId = String(fd.get('factor_id') ?? '') || undefined;
    await verifyTotpForSession(String(fd.get('code') ?? ''), factorId);
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(safeNext(fd.get('next')));
}

export async function startEnrollmentAction(): Promise<{ secret?: string; factorId?: string; uri?: string; qr?: string; error?: string }> {
  const s = await getSession();
  if (!s) return { error: 'Bitte erneut anmelden.' };
  try {
    const e = await beginTotpEnrollment(s);
    const uri = e.uri ?? otpauthUri(e.secret, s.email);
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 240 });
    return { secret: e.secret, factorId: e.factorId, uri, qr };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect('/anmelden');
}
