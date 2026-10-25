'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser, stepUpFresh } from '@/server/auth';
import { db } from '@/server/repo';
import { friendlyDbError } from '@/server/db';
import { assertTimeZone } from '@/lib/domain/time';

export type SettingsState = { error?: string; ok?: string } | undefined;

export async function pauseAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const hours = z.coerce.number().int().min(1).max(24 * 14).parse(fd.get('hours'));
  await db(s).run((q) => q(`update profiles set paused_until = now() + make_interval(hours => $1) where id = auth.uid()`, [hours]));
  await db(s).run((q) => q(`insert into consent_records (user_id, purpose, granted, scope, text_version) values (auth.uid(), 'notify.pause', true, $1, 'v1')`, [JSON.stringify({ hours })]));
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function resumeAction(): Promise<void> {
  const s = await requireUser();
  await db(s).run((q) => q('update profiles set paused_until = null where id = auth.uid()'));
  revalidatePath('/', 'layout');
}

export async function killSwitchAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const on = fd.get('on') === 'true';
  await db(s).run((q) => q('update profiles set kill_switch = $1 where id = auth.uid()', [on]));
  revalidatePath('/', 'layout');
}

export async function saveSettingsAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const s = await requireUser();
  const p = z.object({
    display_name: z.string().trim().max(60).optional(),
    timezone: z.string().min(3).max(60),
    quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/),
    quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/),
    max_notifications_per_day: z.coerce.number().int().min(0).max(20),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: 'Bitte die Eingaben prüfen.' };
  try { assertTimeZone(p.data.timezone); } catch { return { error: 'Unbekannte Zeitzone.' }; }
  const channels = ['email', 'push', 'sms', 'voice'] as const;
  try {
    await db(s).run(async (q) => {
      await q(`update profiles set display_name = nullif($1, ''), timezone = $2, quiet_hours_start = $3, quiet_hours_end = $4,
               max_notifications_per_day = $5 where id = auth.uid()`,
        [p.data.display_name ?? '', p.data.timezone, p.data.quiet_hours_start, p.data.quiet_hours_end, p.data.max_notifications_per_day]);
      for (const c of channels) {
        const want = fd.get(`ch_${c}`) === 'on';
        const cur = await q<{ granted: boolean }>(
          `select granted from consent_records where user_id = auth.uid() and purpose = $1 order by created_at desc, id desc limit 1`, [`notify.${c}`]);
        if ((cur[0]?.granted ?? false) !== want) {
          await q(`insert into consent_records (user_id, purpose, granted, text_version) values (auth.uid(), $1, $2, 'notify-v1')`, [`notify.${c}`, want]);
        }
      }
    });
  } catch (e) {
    return { error: friendlyDbError(e) };
  }
  revalidatePath('/', 'layout');
  return { ok: 'Gespeichert.' };
}

export async function requestDeletionAction(): Promise<void> {
  const s = await requireUser();
  if (!stepUpFresh(s)) redirect(`/sicherheit/code?weiter=${encodeURIComponent('/leben/einstellungen#loeschen')}&grund=${encodeURIComponent('Konto löschen ist endgültig.')}`);
  await db(s).run((q) => q('select app.request_account_deletion()'));
  revalidatePath('/', 'layout');
  redirect('/leben/einstellungen?geloescht=1');
}

export async function aiConsentAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const on = fd.get('on') === 'true';
  await db(s).run((q) => q(`insert into consent_records (user_id, purpose, granted, text_version) values (auth.uid(), 'ai.claude', $1, 'ai-v1')`, [on]));
  revalidatePath('/', 'layout');
}
