import { NextResponse } from 'next/server';
import { withService } from '@/server/db';
import { getFx, getWeather } from '@/server/ext';

export const dynamic = 'force-dynamic';

/** Betriebscheck ohne Daten: Erreicht der Server die Datenbank, und ist das Schema da? */
export async function GET() {
  try {
    const rows = await withService((q) => q<{ tables: number; transitions: number }>(
      `select (select count(*)::int from information_schema.tables where table_schema = 'public') as tables,
              (select count(*)::int from app.task_transitions) as transitions`));
    const [w, fx] = await Promise.all([getWeather('Asia/Dubai'), getFx()]);
    return NextResponse.json({ ok: true, db: 'erreichbar', ...rows[0], region: process.env.VERCEL_REGION ?? 'lokal',
      wetter: w ? 'ok' : 'nicht abrufbar', kurs: fx ? 'ok' : 'nicht abrufbar' },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[health]', e);
    return NextResponse.json({ ok: false, db: 'nicht erreichbar', fehler: (e as Error).message.slice(0, 120) },
      { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
