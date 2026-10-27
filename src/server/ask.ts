import 'server-only';
import { revalidatePath } from 'next/cache';
import type { Session } from '@/server/auth';
import { db } from '@/server/repo';
import { withService } from '@/server/db';
import { FOLDER_LABEL, type Folder } from '@/server/storage';
import { loadExternalEvents } from '@/server/calendars';
import { holidaysBetween } from '@/lib/holidays';
import { observancesBetween } from '@/lib/special-days';
import { chat, CLAUDE_MODEL, type ChatTurn } from '@/server/claude';

/**
 * Kern von „Frag Jarvis“ – genutzt vom Chat in der App und vom Siri-Kurzbefehl.
 * style 'voice': kurze, vorlesbare Antwort (keine Listen, kein Markdown). Wirft bei Fehlern.
 */
export async function askJarvis(s: Session, question: string, history: ChatTurn[], style: 'text' | 'voice' = 'text', via: 'app' | 'siri' = 'app'): Promise<{ answer: string; proposals: string[] }> {
  const profile = await db(s).profile();
  const tz = profile.timezone;
  const ext = await loadExternalEvents(s, new Date(), new Date(Date.now() + 21 * 86_400_000)).catch(() => ({ events: [] }));
  const evFmt = new Intl.DateTimeFormat('de-DE', { timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const evLines = ext.events.slice(0, 60).map((e) => `- ${e.allDay ? `${evFmt.format(e.start).split(',')[0]}, ganztägig` : evFmt.format(e.start)} | ${e.title}${e.location ? ` | ${e.location}` : ''} | ${e.source}`);
  const dn0 = Math.floor(Date.now() / 86_400_000);
  const hol = holidaysBetween(dn0, dn0 + 60).map((h) => `- ${h.date}: ${h.name} (${h.scope})`).join('\n');
  const special = observancesBetween(dn0, dn0 + 60).map((o) => `- ${o.date}: ${o.name}${o.note ? ` (${o.note})` : ''}`).join('\n');
  const context = (await buildContext(s, tz)) + `\n\nTermine aus Saschas Kalender (nächste 3 Wochen, nur lesend):\n${evLines.join('\n') || '- keine / kein Kalender verbunden'}\n\nGesetzliche Feiertage Deutschland/Rheinland-Pfalz (nächste 60 Tage):\n${hol || '- keine'}\n\nBesondere Tage, keine Feiertage (nächste 60 Tage):\n${special || '- keine'}`;
  const now = new Intl.DateTimeFormat('de-DE', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date()) + ` (${tz})`;
  const proposals: string[] = [];

  const answer = await chat(history, question, context, now, async (prop) => {
    const r = await db(s).run((q) => q<{ id: string }>(
      `insert into tasks (user_id, title, why, next_step, domain, status, certainty, due_at, urgency, impact, source_ref)
       values (auth.uid(), $1, $2, $3, $4, 'DETECTED', 'detected',
               case when $5::date is null then null else ($5::date + time '09:00') at time zone $6 end, 2, 2, $7) returning id`,
      [prop.title, `${prop.why} (Vorschlag von Claude im Chat)`, prop.next_step ?? null, prop.domain, prop.due_date ?? null, tz,
       JSON.stringify({ kind: 'chat', via })]));
    proposals.push(prop.title);
    return r.length ? `Angelegt als Vorschlag im Eingang: „${prop.title}“. Sascha muss ihn noch bestätigen.` : 'Nicht angelegt.';
  }, style);
  await withService((q) => q(`select app.log_audit($1, 'jarvis', 'ai.chat', 'profile', $1, $2)`,
    [s.userId, JSON.stringify({ model: CLAUDE_MODEL(), proposals: proposals.length, via })]));
  if (proposals.length) revalidatePath('/', 'layout');
  return { answer, proposals };
}

/** Kompakter Lagebericht aus Saschas Daten – nur Titel/Status/Daten, keine Dateiinhalte. */
async function buildContext(s: Session, tz: string): Promise<string> {
  const d = (x: Date | string | null) => (x ? new Intl.DateTimeFormat('de-DE', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(x)) : '–');
  return db(s).run(async (q) => {
    const [prof] = await q<{ display_name: string | null; moving_date: string | null; moving_date_certainty: string | null; timezone: string }>(
      'select display_name, moving_date, moving_date_certainty, timezone from profiles where id = auth.uid()');
    const tasks = await q<{ title: string; status: string; domain: string; due_at: Date | null; next_step: string | null; certainty: string }>(
      `select title, status::text status, domain, due_at, next_step, certainty::text certainty from tasks
        where deleted_at is null and status not in ('CLOSED','CANCELLED') order by due_at nulls last limit 40`);
    const done = await q<{ title: string; closed_at: Date }>(
      `select title, closed_at from tasks where deleted_at is null and status = 'CLOSED' order by closed_at desc limit 10`);
    const contracts = await q<{ name: string; category: string; is_demo: boolean; earliest_end_date: string | null; status: string | null }>(
      `select c.name, c.category, c.is_demo, c.earliest_end_date,
         (select status::text from cancellation_requests r where r.contract_id = c.id and r.deleted_at is null order by created_at desc limit 1) status
       from contracts c where c.deleted_at is null limit 30`);
    const docs = await q<{ title: string; folder: Folder; issuer: string | null; expires_on: string | null; extracted: Record<string, unknown> }>(
      `select title, folder, issuer, expires_on, extracted from documents where deleted_at is null order by created_at desc limit 60`);
    const [prop] = await q<Record<string, unknown>>(
      `select project_name, developer, location, size_sqft, view_text, financing_ltv_pct, expected_completion, stage from properties where deleted_at is null limit 1`);
    const lines: string[] = [];
    lines.push(`Name: ${prof?.display_name ?? 'Sascha'}; Zeitzone ${prof?.timezone}; Umzugsdatum: ${prof?.moving_date ?? 'offen'} (${prof?.moving_date_certainty ?? 'unbestätigt'})`);
    lines.push(`\nOffene Aufgaben (${tasks.length}):`);
    for (const t of tasks) lines.push(`- ${t.title} | ${t.status} | ${t.domain} | fällig ${d(t.due_at)}${t.next_step ? ` | nächster Schritt: ${t.next_step}` : ''}${t.certainty !== 'verified' ? ` | ${t.certainty}` : ''}`);
    if (done.length) { lines.push('\nZuletzt erledigt:'); for (const t of done) lines.push(`- ${t.title} (${d(t.closed_at)})`); }
    lines.push(`\nVerträge (${contracts.length}):`);
    for (const c of contracts) lines.push(`- ${c.name} | ${c.category}${c.is_demo ? ' | BEISPIEL' : ''} | frühestes Ende ${c.earliest_end_date ?? 'unbekannt'} | Kündigung: ${c.status ?? 'keine'}`);
    lines.push(`\nDokumente (${docs.length}, neueste zuerst):`);
    for (const x of docs) {
      const e = x.extracted ?? {};
      lines.push(`- ${x.title} | ${FOLDER_LABEL[x.folder] ?? x.folder}${x.issuer ? ` | von ${x.issuer}` : ''}${x.expires_on ? ` | läuft ab ${x.expires_on}` : ''}${e.amount != null ? ` | Betrag ${e.amount} ${e.currency ?? ''}` : ''}${e.summary ? ` | ${String(e.summary).slice(0, 200)}` : ''}`);
    }
    if (prop) lines.push(`\nDubai-Wohnung (Angaben = vermutet, nicht belegt): ${JSON.stringify(prop)}`);
    lines.push('\nNicht verbunden: E-Mail, Bankkonten (keine Kontodaten vorhanden).');
    return lines.join('\n').slice(0, 30_000);
  });
}
