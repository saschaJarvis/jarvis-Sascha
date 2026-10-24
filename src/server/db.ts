import 'server-only';
import { Pool, PoolClient } from 'pg';

/**
 * Datenbankzugriff wie PostgREST/Supabase: Jede Nutzeranfrage läuft in einer Transaktion mit
 * `SET LOCAL ROLE authenticated` und den JWT-Claims des Nutzers. Damit greifen RLS, MFA-Policy
 * und alle Guards der Migrationen – auch wenn der Servercode einen Fehler hätte.
 * Funktioniert lokal und gegen die direkte Postgres-Verbindung eines Supabase-Projekts.
 */

const g = globalThis as unknown as { __jarvisPool?: Pool };
export const pool: Pool = g.__jarvisPool ?? new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://postgres@localhost/jarvis_dev?host=/tmp&port=54322',
  max: 10,
});
if (process.env.NODE_ENV !== 'production') g.__jarvisPool = pool;

export interface Claims {
  sub: string;
  role: 'authenticated';
  aal: 'aal1' | 'aal2';
  amr: Array<{ method: string; timestamp: number }>;
  actor?: string;
}

export type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

function q(client: PoolClient): Q {
  return async (sql, params) => (await client.query(sql, params as unknown[])).rows;
}

export async function withUser<T>(claims: Claims, fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const result = await fn(q(client));
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Nur für Serverprozesse ohne Nutzerkontext (Anmeldung, Worker, Scanner). Umgeht RLS – sparsam verwenden. */
export async function withService<T>(fn: (q: Q) => Promise<T>, role: 'service_role' | 'owner' = 'service_role'): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    if (role === 'service_role') await client.query('set local role service_role');
    const result = await fn(q(client));
    await client.query('commit');
    return result;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Datenbankfehler in eine verständliche deutsche Meldung übersetzen (keine internen Details nach außen). */
export function friendlyDbError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/row-level security|permission denied/i.test(msg)) return 'Keine Berechtigung für diese Aktion.';
  // Unsere Guards werfen bewusst deutsche, nutzerverständliche Texte
  const known = /(Ungültiger|erfordert|Erst|Nachweis|Vorbedingung|Freigabe|Step-up|Checkliste|unveränderlich|Entwurf|Versand|abgelaufen|bereits|virenfrei|Zyklisch|nur für|Nur für)/;
  if (known.test(msg)) return msg.replace(/^ERROR:\s*/, '');
  console.error('[db]', msg);
  return 'Das hat nicht geklappt. Bitte später erneut versuchen.';
}
