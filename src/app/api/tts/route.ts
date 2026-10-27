import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/auth';
import { db } from '@/server/repo';
import { synthesize, ttsAvailable } from '@/server/tts';

export const dynamic = 'force-dynamic';

const Body = z.object({
  text: z.string().trim().min(1).max(4000),
  // nur für „Probehören“ in den Einstellungen – sonst gilt die gespeicherte Stimme
  voiceId: z.string().regex(/^[A-Za-z0-9]{10,40}$/).optional(),
  speed: z.number().min(0.7).max(1.2).optional(),
  quality: z.enum(['fast', 'best']).optional(),
});

/** Antwort vorlesen: Text → MP3 über ElevenLabs. Nur angemeldet mit zweitem Faktor. */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.aal !== 'aal2') return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  if (!ttsAvailable()) return NextResponse.json({ error: 'ElevenLabs ist nicht verbunden.' }, { status: 503 });
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  const [v] = await db(s).run((q) => q<{ voice_id: string | null; speed: string; quality: 'fast' | 'best' }>(
    'select voice_id, speed::text speed, quality from voice_settings where user_id = auth.uid()'));
  try {
    const mp3 = await synthesize(b.data.text, {
      voiceId: b.data.voiceId ?? v?.voice_id,
      speed: b.data.speed ?? (v ? Number(v.speed) : 1),
      quality: b.data.quality ?? v?.quality ?? 'fast',
    });
    return new NextResponse(mp3, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sprachausgabe fehlgeschlagen.' }, { status: 502 });
  }
}
