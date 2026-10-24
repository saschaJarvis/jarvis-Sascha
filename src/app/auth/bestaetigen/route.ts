import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { supabaseUser } from '@/server/supabase';

/** Bestätigungslink aus der Registrierungs-E-Mail (Supabase Auth). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const sb = await supabaseUser();
  let ok = false;
  if (code) ok = !(await sb.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await sb.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  return NextResponse.redirect(new URL(ok ? '/sicherheit/einrichten' : '/anmelden?link=ungueltig', req.url));
}
