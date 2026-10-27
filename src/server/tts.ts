import 'server-only';

/**
 * Sprachausgabe über ElevenLabs. Schlüssel: ELEVENLABS_API_KEY (Vercel, Umgebung „Production“).
 * Ohne Schlüssel liest die App weiter mit der Gerätestimme vor.
 */

const API = 'https://api.elevenlabs.io/v1';
const key = () => process.env.ELEVENLABS_API_KEY ?? '';
export const ttsAvailable = () => key().length > 10;

/** Standardstimme, falls noch keine gewählt ist (vorgefertigte ElevenLabs-Stimme „George“, spricht auch Deutsch). */
export const DEFAULT_VOICE = { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' };
const MODEL = { fast: 'eleven_flash_v2_5', best: 'eleven_multilingual_v2' } as const;

export interface Voice { id: string; name: string; info: string; preview: string | null; mine: boolean }

export async function listVoices(): Promise<Voice[]> {
  const r = await fetch(`${API}/voices`, { headers: { 'xi-api-key': key() }, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(r.status === 401 ? 'ElevenLabs-Schlüssel ungültig oder ohne Rechte „Voices: Read“.' : `ElevenLabs antwortet nicht (${r.status}).`);
  const j = (await r.json()) as { voices: Array<{ voice_id: string; name: string; category?: string; preview_url?: string; labels?: Record<string, string> }> };
  return j.voices.map((v) => ({
    id: v.voice_id,
    name: v.name,
    info: [v.labels?.gender === 'male' ? 'männlich' : v.labels?.gender === 'female' ? 'weiblich' : null, v.labels?.accent, v.labels?.age, v.labels?.description ?? v.labels?.descriptive]
      .filter(Boolean).join(' · '),
    preview: v.preview_url ?? null,
    mine: v.category !== 'premade',
  })).sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name, 'de'));
}

export interface Quota { used: number; limit: number; resetsAt: Date | null; tier: string }

export async function quota(): Promise<Quota | null> {
  const r = await fetch(`${API}/user/subscription`, { headers: { 'xi-api-key': key() }, cache: 'no-store', signal: AbortSignal.timeout(8_000) }).catch(() => null);
  if (!r?.ok) return null; // Schlüssel ohne „User: Read“ – dann einfach keine Anzeige
  const j = (await r.json()) as { character_count: number; character_limit: number; next_character_count_reset_unix?: number; tier?: string };
  return { used: j.character_count, limit: j.character_limit, tier: j.tier ?? '', resetsAt: j.next_character_count_reset_unix ? new Date(j.next_character_count_reset_unix * 1000) : null };
}

/** Text → MP3. Markdown wird vorher entfernt, damit nichts „Sternchen“ vorgelesen wird. */
export async function synthesize(text: string, opts: { voiceId?: string | null; speed?: number; quality?: 'fast' | 'best' }): Promise<ArrayBuffer> {
  const clean = speakable(text).slice(0, 2500);
  const voice = opts.voiceId || DEFAULT_VOICE.id;
  const r = await fetch(`${API}/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key(), 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text: clean,
      model_id: MODEL[opts.quality ?? 'fast'],
      language_code: opts.quality === 'best' ? undefined : 'de',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: Math.min(1.2, Math.max(0.7, opts.speed ?? 1)) },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) {
    const msg = r.status === 401 ? 'ElevenLabs-Schlüssel ungültig.' : r.status === 429 ? 'ElevenLabs: zu viele Anfragen oder Guthaben aufgebraucht.'
      : (await r.text().catch(() => '')).includes('quota') ? 'ElevenLabs-Guthaben aufgebraucht.' : `ElevenLabs-Fehler (${r.status}).`;
    throw new Error(msg);
  }
  return r.arrayBuffer();
}

export function speakable(text: string): string {
  return text
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[*_#`>|]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/→/g, ', dann ')
    .replace(/\s+/g, ' ')
    .trim();
}
