import 'server-only';
import type { Session } from './auth';
import { db } from './repo';
import { withService } from './db';
import { parseIcs, providerForHost } from '@/lib/ics';
import type { CalExternal } from '@/lib/calendar';
import { werderEvents } from './football';

export interface SourceRow { id: string; name: string; provider: string; url: string; created_at: Date }
export interface SourceStatus { id: string; name: string; provider: string; ok: boolean; count: number; error?: string; hint: string }

const MAX_BYTES = 5 * 1024 * 1024;
/** Testmodus nur bei lokaler Anmeldung (E2E) */
const fake = () => process.env.CALENDAR_FAKE === '1' && process.env.AUTH_PROVIDER !== 'supabase';

export const listSources = (s: Session) =>
  db(s).run((q) => q<SourceRow>('select id, name, provider, url, created_at from calendar_sources where deleted_at is null order by created_at'));

/** Link nie vollständig anzeigen – er ist ein Geheimnis. */
export const maskUrl = (url: string) => { const u = new URL(url); return `${u.hostname}/…${u.pathname.slice(-6)}`; };

async function fetchIcs(url: string): Promise<string> {
  if (fake()) return fakeIcs();
  const r = await fetch(url, { headers: { accept: 'text/calendar, text/plain;q=0.8' }, next: { revalidate: 600 }, signal: AbortSignal.timeout(8000) });
  // Nach Weiterleitungen muss der Server weiterhin ein bekannter Kalender-Anbieter sein
  if (!providerForHost(new URL(r.url || url).hostname)) throw new Error('Weiterleitung zu unbekannter Adresse – abgebrochen.');
  if (r.status === 404 || r.status === 403) throw new Error('Link nicht (mehr) gültig. Ist der Kalender noch „öffentlich“?');
  if (!r.ok) throw new Error(`Kalender nicht erreichbar (${r.status}).`);
  const len = Number(r.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) throw new Error('Kalender ist zu groß.');
  const text = await r.text();
  if (text.length > MAX_BYTES) throw new Error('Kalender ist zu groß.');
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Unter dem Link liegt kein Kalender.');
  return text;
}

export async function loadExternalEvents(s: Session, from: Date, to: Date): Promise<{ events: CalExternal[]; sources: SourceStatus[] }> {
  const rows = await listSources(s);
  const results = await Promise.all(rows.map(async (src) => {
    try {
      const evs = parseIcs(await fetchIcs(src.url), from, to);
      return { events: evs.map((e) => ({ ...e, source: src.name })), status: { id: src.id, name: src.name, provider: src.provider, ok: true, count: evs.length, hint: maskUrl(src.url) } };
    } catch (e) {
      console.error('[kalender]', src.provider, (e as Error).message);
      return { events: [], status: { id: src.id, name: src.name, provider: src.provider, ok: false, count: 0, error: (e as Error).message.slice(0, 160), hint: maskUrl(src.url) } };
    }
  }));
  // Werder-Spielplan immer dabei (kein Link nötig)
  const werder = fake() ? [] : await werderEvents(from, to).catch(() => [] as CalExternal[]);
  return { events: [...results.flatMap((r) => r.events), ...werder], sources: results.map((r) => r.status) };
}

function fakeIcs(): string {
  const d = new Date();
  const ymd = (n: number) => { const x = new Date(d.getTime() + n * 86_400_000); return `${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}${String(x.getUTCDate()).padStart(2, '0')}`; };
  return ['BEGIN:VCALENDAR', 'VERSION:2.0',
    'BEGIN:VEVENT', 'UID:fake-1', `DTSTART:${ymd(1)}T060000Z`, `DTEND:${ymd(1)}T070000Z`, 'SUMMARY:Testtermin aus dem iPhone', 'LOCATION:Dubai Marina', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:fake-2', `DTSTART;VALUE=DATE:${ymd(0)}`, `DTEND;VALUE=DATE:${ymd(1)}`, 'SUMMARY:Ganztägig heute', 'END:VEVENT',
    'END:VCALENDAR'].join('\r\n');
}

/** Termine eines Nutzers für den Wächter (ohne Sitzung, nur serverseitig). Fehlerhafte Kalender werden übersprungen. */
export async function eventsForUser(userId: string, from: Date, to: Date): Promise<CalExternal[]> {
  const rows = await withService((q) => q<{ name: string; url: string; provider: string }>(
    'select name, url, provider from calendar_sources where user_id = $1 and deleted_at is null', [userId]));
  const lists = await Promise.all(rows.map(async (src) => {
    try { return parseIcs(await fetchIcs(src.url), from, to).map((e) => ({ ...e, source: src.name })); }
    catch (e) { console.error('[erinnerung]', src.provider, (e as Error).message); return []; }
  }));
  return lists.flat();
}
