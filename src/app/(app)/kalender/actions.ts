'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { friendlyDbError } from '@/server/db';
import { normalizeCalendarUrl, parseIcs, providerForHost } from '@/lib/ics';

export type CalState = { error?: string; ok?: string } | undefined;

export async function addCalendarAction(_: CalState, fd: FormData): Promise<CalState> {
  const s = await requireUser();
  const name = String(fd.get('name') ?? '').trim().slice(0, 60) || 'iPhone';
  const n = normalizeCalendarUrl(String(fd.get('url') ?? ''));
  if ('error' in n) return { error: n.error };

  // Einmal testweise abrufen, damit Fehler sofort sichtbar sind (nicht erst später im Kalender)
  if (!(process.env.CALENDAR_FAKE === '1' && process.env.AUTH_PROVIDER !== 'supabase')) {
    try {
      const r = await fetch(n.url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!providerForHost(new URL(r.url || n.url).hostname)) return { error: 'Der Link leitet zu einer unbekannten Adresse weiter.' };
      if (!r.ok) return { error: r.status === 404 || r.status === 403 ? 'Der Link funktioniert nicht. Ist „Öffentlicher Kalender“ eingeschaltet?' : `Kalender nicht erreichbar (${r.status}).` };
      const text = await r.text();
      if (!text.includes('BEGIN:VCALENDAR')) return { error: 'Unter dem Link liegt kein Kalender.' };
      parseIcs(text, new Date(), new Date(Date.now() + 86_400_000));
    } catch (e) {
      console.error('[kalender:add]', (e as Error).message);
      return { error: 'Kalender konnte nicht gelesen werden. Bitte Link prüfen.' };
    }
  }
  try {
    await db(s).run((q) => q('insert into calendar_sources (user_id, name, provider, url) values (auth.uid(), $1, $2, $3)', [name, n.provider, n.url]));
  } catch (e) {
    const m = e instanceof Error ? e.message : '';
    if (/calendar_sources_unique_url/.test(m)) return { error: 'Dieser Kalender ist schon verbunden.' };
    if (/Höchstens 10/.test(m)) return { error: 'Höchstens 10 Kalender – bitte erst einen entfernen.' };
    return { error: friendlyDbError(e) };
  }
  revalidatePath('/', 'layout');
  return { ok: `„${name}“ ist verbunden. Termine erscheinen jetzt im Kalender (Aktualisierung alle ~10 Minuten).` };
}

export async function removeCalendarAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const id = z.string().uuid().parse(fd.get('id'));
  await db(s).run((q) => q('update calendar_sources set deleted_at = now() where id = $1 and deleted_at is null', [id]));
  revalidatePath('/', 'layout');
}
