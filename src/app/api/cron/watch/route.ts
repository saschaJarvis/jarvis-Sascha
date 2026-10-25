import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runWatch } from '@/server/watch';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Wächter-Lauf (alle 5 Minuten von Supabase pg_cron aufgerufen). Nur mit geheimem Schlüssel. */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET ?? '';
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const ok = secret.length >= 32 && got.length === secret.length && timingSafeEqual(Buffer.from(got), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const r = await runWatch();
    return NextResponse.json({ ok: true, ...r }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[watch]', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
export const GET = handle;
export const POST = handle;
