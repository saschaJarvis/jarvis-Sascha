'use server';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { askJarvis } from '@/server/ask';
import { AI_CONSENT, AI_CONSENT_TEXT, claudeAvailable, type ChatTurn } from '@/server/claude';

export interface ChatReply { answer?: string; proposals?: string[]; error?: string }

const Input = z.object({
  question: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(8000) })).max(30),
  consent: z.boolean(),
  voice: z.boolean().optional(),
});

export async function askJarvisAction(raw: { question: string; history: ChatTurn[]; consent: boolean; voice?: boolean }): Promise<ChatReply> {
  const s = await requireUser();
  const p = Input.safeParse(raw);
  if (!p.success) return { error: 'Bitte eine Frage eingeben (max. 2000 Zeichen).' };
  if (!claudeAvailable()) return { error: 'Claude ist noch nicht verbunden (API-Schlüssel fehlt).' };

  let consent = await db(s).run(async (q) => (await q<{ ok: boolean }>('select app.has_consent(auth.uid(), $1) as ok', [AI_CONSENT]))[0].ok);
  if (!consent && p.data.consent) {
    await db(s).run((q) => q('insert into consent_records (user_id, purpose, granted, text_version) values (auth.uid(), $1, true, $2)', [AI_CONSENT, AI_CONSENT_TEXT]));
    consent = true;
  }
  if (!consent) return { error: 'Bitte zuerst zustimmen, dass deine Jarvis-Daten an Claude gesendet werden dürfen.' };

  try {
    return await askJarvis(s, p.data.question, p.data.history, p.data.voice ? 'voice' : 'text');
  } catch (e) {
    return { error: e instanceof Error && /Claude|Schlüssel|Guthaben/.test(e.message) ? e.message : 'Das hat nicht geklappt. Bitte erneut versuchen.' };
  }
}
