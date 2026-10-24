'use server';
import { redirect } from 'next/navigation';
import { signIn, signOut, signUp, verifyTotpForSession } from '@/server/auth';

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
    await verifyTotpForSession(String(fd.get('code') ?? ''));
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(safeNext(fd.get('next')));
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect('/anmelden');
}
