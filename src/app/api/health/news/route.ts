import { NextResponse } from 'next/server';
import { loadTopic } from '@/server/news';
import { TOPICS } from '@/lib/news';

export const dynamic = 'force-dynamic';

/** Betriebscheck der Nachrichtenquellen: nur Anzahl und Fehler, keine Inhalte. */
export async function GET() {
  const topics = await Promise.all(TOPICS.map((t) => loadTopic(t.key)));
  return NextResponse.json(Object.fromEntries(topics.map(({ topic, sources }) => [topic.key,
    Object.fromEntries(sources.map((s) => [s.source.key, s.error ? { ok: false, fehler: s.error } : { ok: true, meldungen: s.items.length }]))])),
    { headers: { 'Cache-Control': 'no-store' } });
}
