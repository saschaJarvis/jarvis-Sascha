'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser, usingSupabase } from '@/server/auth';
import { db } from '@/server/repo';
import { friendlyDbError, withService } from '@/server/db';
import { FOLDERS, FOLDER_LABEL, storeUpload, type Folder } from '@/server/storage';
import { kickStatements } from '@/server/statements';
import { kickMetalInvoices } from '@/server/metal-invoices';
import { AI_CONSENT, AI_CONSENT_TEXT, analyzeDocument, claudeAvailable, CLAUDE_MODEL, guessFolderFromName, type DocAnalysis } from '@/server/claude';

export interface SortResult {
  name: string;
  ok: boolean;
  error?: string;
  documentId?: string;
  title?: string;
  folder?: Folder;
  folderLabel?: string;
  summary?: string;
  issuer?: string | null;
  amount?: string | null;
  tasks?: number;
  byClaude?: boolean;
  duplicateOf?: string | null;
}
export type SortState = { results?: SortResult[]; error?: string; note?: string } | undefined;

const ANALYZABLE = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_TOTAL = () => (usingSupabase() ? 4 : 20) * 1024 * 1024;

export async function sortUploadAction(_: SortState, fd: FormData): Promise<SortState> {
  const s = await requireUser();
  const files = fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0).slice(0, 5);
  if (files.length === 0) return { error: 'Bitte eine Datei auswählen.' };
  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > MAX_TOTAL()) return { error: `Zusammen zu groß (max. ${MAX_TOTAL() / 1024 / 1024} MB pro Hochladen). Bitte einzeln hochladen.` };

  const profile = await db(s).profile();
  // Einwilligung: einmalig per Häkchen, danach gespeichert (widerrufbar in den Einstellungen)
  let consent = await db(s).run(async (q) => (await q<{ ok: boolean }>('select app.has_consent(auth.uid(), $1) as ok', [AI_CONSENT]))[0].ok);
  if (!consent && fd.get('consent') === 'on') {
    await db(s).run((q) => q('insert into consent_records (user_id, purpose, granted, text_version) values (auth.uid(), $1, true, $2)', [AI_CONSENT, AI_CONSENT_TEXT]));
    consent = true;
  }
  const useClaude = claudeAvailable() && consent;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: profile.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  const results: SortResult[] = [];
  for (const file of files) {
    const name = file.name || 'Datei';
    try {
      const guess = guessFolderFromName(name);
      const stored = await storeUpload(s, file, { title: name.replace(/\.[a-z0-9]+$/i, '').slice(0, 200) || 'Dokument', folder: guess });
      if (stored.scan === 'infected') { results.push({ name, ok: false, error: 'Als gefährlich erkannt und gesperrt.' }); continue; }

      let a: DocAnalysis | null = null;
      let aiError: string | undefined;
      if (useClaude && ANALYZABLE.has(stored.mime)) {
        try { a = await analyzeDocument(Buffer.from(await file.arrayBuffer()), stored.mime, name, today); }
        catch (e) { aiError = e instanceof Error ? e.message : 'Claude-Fehler'; }
      }

      let taskCount = 0;
      // Edelmetall-Käufe immer nach „Edelmetalle“ – dort liest Jarvis die Positionen fürs Gesamtvermögen aus
      if (a && a.folder !== 'metals' && /rechnung|lieferschein|kauf|auftrag|invoice/i.test(a.kind)
          && /gold|silber|silver|platin|philharmoniker|maple.?leaf|kr(ue|ü)gerrand|britannia|k(ae|ä)nguru|eagle|feinunze|\b1 ?oz\b|barren|m(ue|ü)nze/i.test(`${a.title} ${a.summary} ${a.issuer ?? ''}`)) {
        a = { ...a, folder: 'metals' };
      }
      if (a) {
        const an = a;
        await db(s).run(async (q) => {
          await q(`update documents set title = $2, folder = $3, issuer = $4, expires_on = $5::date, sensitivity = $6, tags = $7,
                     certainty = 'detected', extracted = $8 where id = $1`,
            [stored.documentId, an.title, an.folder, an.issuer ?? null, an.expires_on ?? null, an.sensitivity, an.tags,
             JSON.stringify({ by: 'claude', model: CLAUDE_MODEL(), kind: an.kind, summary: an.summary, document_date: an.document_date ?? null,
               amount: an.amount ?? null, currency: an.currency ?? null, confidence: an.confidence, analyzed_at: new Date().toISOString() })]);
          for (const [i, t] of an.tasks.entries()) {
            const r = await q(
              `insert into tasks (user_id, title, why, next_step, domain, status, certainty, due_at, due_is_hard, urgency, impact, source_ref, idempotency_key)
               values (auth.uid(), $1, $2, $3, $4, 'DETECTED', 'detected',
                       case when $5::date is null then null else ($5::date + time '09:00') at time zone $6 end, $7, $8, 2, $9, $10)
               on conflict (user_id, idempotency_key) do nothing returning id`,
              [t.title, `${t.why} (aus „${an.title}“)`, t.next_step ?? null, t.domain, t.due_date ?? null, profile.timezone,
               t.due_is_hard && !!t.due_date, t.urgency, JSON.stringify({ kind: 'document', document_id: stored.documentId }), `doc:${stored.versionId}:${i}`]);
            taskCount += r.length;
          }
        });
        await withService((q) => q(`select app.log_audit($1, 'jarvis', 'ai.document_sorted', 'document', $2, $3)`,
          [s.userId, stored.documentId, JSON.stringify({ model: CLAUDE_MODEL(), folder: an.folder, tasks: taskCount, confidence: an.confidence })]));
      }

      const folder = (a?.folder ?? guess) as Folder;
      results.push({
        name, ok: true, documentId: stored.documentId, folder, folderLabel: FOLDER_LABEL[folder],
        title: a?.title ?? name, summary: a?.summary ?? (aiError ? `Nach Dateiname einsortiert – ${aiError}` : !useClaude ? 'Nach Dateiname einsortiert.' : 'Dieser Dateityp wird nicht gelesen – nach Dateiname einsortiert.'),
        issuer: a?.issuer ?? null,
        amount: a?.amount != null ? `${a.amount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${a.currency ?? ''}`.trim() : null,
        tasks: taskCount, byClaude: !!a, duplicateOf: stored.duplicateOf,
      });
    } catch (e) {
      results.push({ name, ok: false, error: e instanceof Error && /^(Datei|Claude)/.test(e.message) ? e.message : friendlyDbError(e) });
    }
  }
  // Neue Kontoauszüge gleich im Hintergrund auswerten (Finanzen + Brücke aktualisieren sich danach)
  let statementNote: string | undefined;
  if (results.some((r) => r.ok && r.folder === 'banks')) {
    try {
      const n = await kickStatements(s);
      if (n) statementNote = `${n === 1 ? 'Kontoauszug wird' : `${n} Kontoauszüge werden`} jetzt ausgewertet – in 1–3 Minuten unter Finanzen.`;
    } catch (e) { console.error('[statement] kick', e); }
  }
  if (results.some((r) => r.ok && r.folder === 'metals')) {
    try {
      const n = await kickMetalInvoices(s);
      if (n) statementNote = `${statementNote ? `${statementNote} ` : ''}${n === 1 ? 'Edelmetall-Rechnung wird' : `${n} Edelmetall-Rechnungen werden`} jetzt ausgelesen – in etwa einer Minute unter Finanzen.`;
    } catch (e) { console.error('[metal-invoice] kick', e); }
  }
  revalidatePath('/', 'layout');
  if (statementNote) return { results, note: statementNote };
  const note = !claudeAvailable() ? 'Claude ist noch nicht verbunden – sortiert wurde nur nach Dateiname.'
    : !consent ? 'Ohne dein Häkchen liest Claude nicht mit – sortiert wurde nur nach Dateiname.' : undefined;
  return { results, note };
}

/** Falsch einsortiert? Ordner korrigieren – gilt dann als von dir bestätigt. */
export async function moveDocumentAction(fd: FormData): Promise<void> {
  const s = await requireUser();
  const id = z.string().uuid().parse(fd.get('id'));
  const folder = z.enum(FOLDERS).parse(fd.get('folder'));
  await db(s).run((q) => q(`update documents set folder = $2, certainty = 'verified' where id = $1`, [id, folder]));
  if (folder === 'metals') await kickMetalInvoices(s).catch((e) => console.error('[metal-invoice] kick', e));
  if (folder === 'banks') await kickStatements(s).catch((e) => console.error('[statement] kick', e));
  revalidatePath('/', 'layout');
}
