import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Erneuert die Supabase-Sitzung (Cookies) vor jedem Seitenaufruf.
 * Nur aktiv mit AUTH_PROVIDER=supabase; die eigentliche Zugriffsprüfung macht jede Seite/Action selbst.
 */
export async function proxy(request: NextRequest) {
  if (process.env.AUTH_PROVIDER !== 'supabase') return NextResponse.next();
  let response = NextResponse.next({ request });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await sb.auth.getClaims();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon.svg|manifest.webmanifest).*)'],
};
