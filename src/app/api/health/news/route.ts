import { NextResponse } from 'next/server';
import { loadTopic } from '@/server/news';

export const dynamic = 'force-dynamic';

/** Betriebscheck der Nachrichtenquellen: nur Anzahl und Fehler, keine Inhalte. */
export async function GET() {
  const { sources } = await loadTopic('werder');
  return NextResponse.json(
    Object.fromEntries(sources.map((s) => [s.source.key, s.error ? { ok: false, fehler: s.error } : { ok: true, meldungen: s.items.length }])),
    { headers: { 'Cache-Control': 'no-store' } });
}
