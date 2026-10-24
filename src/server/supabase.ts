import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} fehlt – siehe .env.example`);
  return v;
}

/** Supabase-Client im Namen des angemeldeten Nutzers (Cookies). RLS gilt. */
export async function supabaseUser(): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // In Server Components dürfen keine Cookies gesetzt werden – der Proxy erneuert die Sitzung.
        }
      },
    },
  });
}

/** Dienst-Client (umgeht RLS). NUR serverseitig, nur für Worker/Scanner. */
export function supabaseService(): SupabaseClient {
  return createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
