'use server';
import { revalidatePath } from 'next/cache';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { requireUser, stepUpFresh } from '@/server/auth';
import { db } from '@/server/repo';
import { friendlyDbError, withService } from '@/server/db';

export type VoiceState = { ok?: string; error?: string; token?: string; needCode?: boolean } | undefined;

const Voice = z.object({
  voiceId: z.string().regex(/^[A-Za-z0-9]{10,40}$/),
  voiceName: z.string().max(120),
  speed: z.number().min(0.7).max(1.2),
  quality: z.enum(['fast', 'best']),
});

export async function saveVoiceAction(raw: z.input<typeof Voice>): Promise<VoiceState> {
  const s = await requireUser();
  const v = Voice.safeParse(raw);
  if (!v.success) return { error: 'Ungültige Auswahl.' };
  try {
    await db(s).run((q) => q(
      `insert into voice_settings (user_id, voice_id, voice_name, speed, quality) values (auth.uid(), $1, $2, $3, $4)
       on conflict (user_id) do update set voice_id = excluded.voice_id, voice_name = excluded.voice_name, speed = excluded.speed, quality = excluded.quality`,
      [v.data.voiceId, v.data.voiceName, v.data.speed, v.data.quality]));
  } catch (e) { return { error: friendlyDbError(e) }; }
  revalidatePath('/leben/einstellungen');
  return { ok: `Jarvis spricht jetzt mit „${v.data.voiceName}“.` };
}

/** Neuer Siri-Schlüssel. Verlangt einen frischen Authenticator-Code, weil er Lesezugriff über Claude gibt. */
export async function createSiriTokenAction(label: string): Promise<VoiceState> {
  const s = await requireUser();
  if (!stepUpFresh(s)) return { needCode: true };
  const token = `jv_${randomBytes(32).toString('base64url')}`;
  const hash = createHash('sha256').update(token).digest('hex');
  try {
    await db(s).run((q) => q('insert into siri_tokens (user_id, token_hash, label) values (auth.uid(), $1, $2)', [hash, (label || 'iPhone').slice(0, 60)]));
    await withService((q) => q(`select app.log_audit($1, 'user', 'siri.token_created', 'profile', $1, '{}'::jsonb)`, [s.userId]));
  } catch (e) { return { error: friendlyDbError(e) }; }
  revalidatePath('/leben/einstellungen');
  return { token, ok: 'Schlüssel erstellt – jetzt kopieren, er wird nur einmal angezeigt.' };
}

export async function revokeSiriTokenAction(id: string): Promise<VoiceState> {
  const s = await requireUser();
  if (!z.string().uuid().safeParse(id).success) return { error: 'Ungültig.' };
  await db(s).run((q) => q('update siri_tokens set revoked_at = now() where id = $1 and revoked_at is null', [id]));
  await withService((q) => q(`select app.log_audit($1, 'user', 'siri.token_revoked', 'profile', $1, '{}'::jsonb)`, [s.userId]));
  revalidatePath('/leben/einstellungen');
  return { ok: 'Schlüssel gesperrt. Der Kurzbefehl funktioniert damit nicht mehr.' };
}
