import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Session } from '@/server/auth';
import { isAllowedUser } from '@/server/auth';
import { withService } from '@/server/db';
import { db } from '@/server/repo';
import { askJarvis } from '@/server/ask';
import { AI_CONSENT, claudeAvailable } from '@/server/claude';
import { synthesize, ttsAvailable } from '@/server/tts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Siri-Kurzbefehl „Jarvis“: POST mit „Authorization: Bearer <persönlicher Schlüssel>“ und {"frage": "…"}.
 * Antwort: JSON {"antwort": "…"} – oder mit ?stimme=1 direkt als MP3 (ElevenLabs-Stimme).
 * Der Schlüssel wird in den Einstellungen erzeugt (nur als Hash gespeichert) und ist jederzeit sperrbar.
 * Er erlaubt nur Fragen an Jarvis; Freigaben, Export oder Löschen brauchen weiterhin den Authenticator-Code.
 */
const Body = z.object({ frage: z.string().trim().min(1).max(1500) });

// Einfache Bremse gegen Missbrauch (pro Server-Instanz): höchstens 30 Fragen je 10 Minuten und Schlüssel
const hits = new Map<string, number[]>();
function limited(id: string): boolean {
  const now = Date.now();
  const h = (hits.get(id) ?? []).filter((t) => now - t < 600_000);
  h.push(now);
  hits.set(id, h);
  return h.length > 30;
}

const say = (antwort: string, status = 200) => NextResponse.json({ antwort }, { status });

export async function POST(req: NextRequest) {
  const token = /^Bearer\s+(jv_[A-Za-z0-9_-]{40,60})$/.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!token) return say('Kein gültiger Jarvis-Schlüssel im Kurzbefehl.', 401);
  const hash = createHash('sha256').update(token).digest('hex');
  const [t] = await withService((q) => q<{ id: string; user_id: string }>(
    'update siri_tokens set last_used_at = now() where token_hash = $1 and revoked_at is null returning id, user_id', [hash]));
  if (!t || !isAllowedUser(t.user_id)) return say('Dieser Jarvis-Schlüssel ist ungültig oder gesperrt.', 401);
  if (limited(t.id)) return say('Kurze Pause bitte – zu viele Fragen in kurzer Zeit.', 429);
  if (!claudeAvailable()) return say('Claude ist in Jarvis noch nicht verbunden.', 503);

  const raw = await req.json().catch(() => null);
  const b = Body.safeParse(raw ?? {});
  if (!b.success) return say('Ich habe keine Frage verstanden.', 400);

  // Sitzung des Schlüssel-Inhabers. „siri-token“ zählt nie als frischer Authenticator-Code (kein Step-up).
  const s: Session = {
    userId: t.user_id, email: '', aal: 'aal2', totpEnabled: true, mfaAt: null,
    claims: { sub: t.user_id, role: 'authenticated', aal: 'aal2', amr: [{ method: 'siri-token', timestamp: Math.floor(Date.now() / 1000) }], actor: 'siri' },
  };
  const consent = await db(s).run(async (q) => (await q<{ ok: boolean }>('select app.has_consent(auth.uid(), $1) as ok', [AI_CONSENT]))[0].ok);
  if (!consent) return say('Bitte erst in der Jarvis-App zustimmen, dass Claude deine Daten lesen darf.', 403);

  let antwort: string;
  try {
    const r = await askJarvis(s, b.data.frage, [], 'voice', 'siri');
    antwort = r.answer + (r.proposals.length ? ` Ich habe ${r.proposals.length === 1 ? 'einen Vorschlag' : `${r.proposals.length} Vorschläge`} in deinen Eingang gelegt.` : '');
  } catch {
    return say('Das hat gerade nicht geklappt. Bitte gleich nochmal versuchen.', 502);
  }

  if (req.nextUrl.searchParams.get('stimme') === '1' && ttsAvailable()) {
    try {
      const [v] = await db(s).run((q) => q<{ voice_id: string | null; speed: string; quality: 'fast' | 'best' }>(
        'select voice_id, speed::text speed, quality from voice_settings where user_id = auth.uid()'));
      const mp3 = await synthesize(antwort, { voiceId: v?.voice_id, speed: v ? Number(v.speed) : 1, quality: v?.quality ?? 'fast' });
      return new NextResponse(mp3, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } });
    } catch { /* Guthaben leer o. Ä. → Text zurück, Siri liest dann selbst vor */ }
  }
  return say(antwort);
}
