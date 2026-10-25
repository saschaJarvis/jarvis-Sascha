import 'server-only';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { sha256Hex } from './crypto';
import { withService } from './db';
import { db } from './repo';
import { usingSupabase, type Session } from './auth';
import { supabaseUser } from './supabase';

/**
 * Private Dateiablage. Lokal: Verzeichnis STORAGE_DIR (außerhalb von public/). In Produktion: privater
 * Supabase-Bucket „vault" mit identischem Pfadschema <user_id>/<document_id>/v<n>-<sha>.<ext>.
 * Der Dateityp wird an den ersten Bytes erkannt – die Angabe des Browsers wird nicht geglaubt.
 */

// Vercel-Funktionen nehmen max. ~4,5 MB pro Anfrage an; lokal sind 20 MB möglich.
const MAX_BYTES = () => (usingSupabase() ? 4 : 20) * 1024 * 1024;
const root = () => path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.STORAGE_DIR ?? '.storage');

export const FOLDERS = ['identity', 'housing', 'office', 'storage', 'business', 'taxes', 'banks', 'crypto', 'insurance',
  'subscriptions', 'shipping', 'customs', 'visa', 'uae_property', 'utilities', 'healthcare', 'vehicles', 'travel', 'legal', 'metals', 'other'] as const;
export type Folder = (typeof FOLDERS)[number];

export const FOLDER_LABEL: Record<Folder, string> = {
  identity: 'Ausweise', housing: 'Wohnung', office: 'Büro', storage: 'Lager', business: 'Firma', taxes: 'Steuern',
  banks: 'Banken', crypto: 'Krypto', insurance: 'Versicherungen', subscriptions: 'Abos', shipping: 'Versand/Umzug',
  customs: 'Zoll', visa: 'Visum', uae_property: 'Dubai-Wohnung', utilities: 'Strom/Wasser', healthcare: 'Gesundheit',
  vehicles: 'Fahrzeuge', travel: 'Reisen', legal: 'Rechtliches', metals: 'Edelmetalle', other: 'Sonstiges',
};

export function sniffMime(buf: Buffer, filename: string): { mime: string; ext: string } | null {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp' && /^(heic|heix|mif1|msf1)$/.test(buf.subarray(8, 12).toString('latin1'))) return { mime: 'image/heic', ext: 'heic' };
  if (buf[0] === 0x50 && buf[1] === 0x4b && ext === 'xlsx') return { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' };
  const head = buf.subarray(0, 4096);
  const isText = !head.includes(0);
  if (isText && ext === 'csv') return { mime: 'text/csv', ext: 'csv' };
  if (isText && ext === 'eml') return { mime: 'message/rfc822', ext: 'eml' };
  return null;
}

const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/**
 * PLATZHALTER-Scanner (Feature-Matrix: MOCKED). Erkennt nur die EICAR-Testsignatur und
 * aktive Inhalte in PDFs (JavaScript/Launch). In Produktion durch ClamAV o. ä. ersetzen.
 */
export function devScan(buf: Buffer, mime: string): 'clean' | 'infected' {
  const s = buf.toString('latin1');
  if (s.includes(EICAR)) return 'infected';
  if (mime === 'application/pdf' && /\/(JavaScript|JS|Launch|EmbeddedFile)\b/.test(s)) return 'infected';
  return 'clean';
}

export async function storeUpload(s: Session, file: File, meta: { title: string; folder: Folder; documentId?: string; tags?: string[] }) {
  if (file.size > MAX_BYTES()) throw new Error(`Datei ist zu groß (max. ${MAX_BYTES() / 1024 / 1024} MB).`);
  const buf = Buffer.from(await file.arrayBuffer());
  const sniff = sniffMime(buf, file.name);
  if (!sniff) throw new Error('Datei-Typ nicht erlaubt. Erlaubt: PDF, Foto (JPG/PNG/HEIC), CSV, XLSX, E-Mail (.eml).');
  const sha = sha256Hex(buf);

  const { documentId, versionId, versionNo, duplicateOf } = await db(s).run(async (q) => {
    const dup = await q<{ title: string }>(
      `select d.title from document_versions v join documents d on d.id = v.document_id where v.sha256 = $1 limit 1`, [sha]);
    let docId = meta.documentId;
    if (!docId) {
      const r = await q<{ id: string }>(
        `insert into documents (user_id, title, folder, state, tags) values (auth.uid(), $1, $2, 'uploaded', $3) returning id`,
        [meta.title, meta.folder, meta.tags ?? []]);
      docId = r[0].id;
    } else {
      await q(`update documents set state = 'uploaded' where id = $1 and state in ('requested','rejected')`, [docId]);
    }
    const n = await q<{ n: number }>('select coalesce(max(version_no), 0) + 1 as n from document_versions where document_id = $1', [docId]);
    const versionNo = n[0].n;
    const storagePath = `${s.userId}/${docId}/v${versionNo}-${sha.slice(0, 16)}.${sniff.ext}`;
    const v = await q<{ id: string }>(
      `insert into document_versions (document_id, user_id, version_no, storage_path, sha256, size_bytes, mime_type)
       values ($1, auth.uid(), $2, $3, $4, $5, $6) returning id`, [docId, versionNo, storagePath, sha, buf.length, sniff.mime]);
    await putBlob(storagePath, buf, sniff.mime);
    return { documentId: docId, versionId: v[0].id, versionNo, duplicateOf: dup[0]?.title ?? null };
  });

  const scan = devScan(buf, sniff.mime);
  await withService((q) => q('update document_versions set scan_status = $2 where id = $1', [versionId, scan]));
  return { documentId, versionId, versionNo, scan, duplicateOf, mime: sniff.mime };
}

async function putBlob(storagePath: string, buf: Buffer, mime: string): Promise<void> {
  if (usingSupabase()) {
    // Upload im Namen des Nutzers: Storage-Policy prüft Ordner = eigene user_id und aal2
    const sb = await supabaseUser();
    const { error } = await sb.storage.from('vault').upload(storagePath, buf, { contentType: mime, upsert: false });
    if (error) throw new Error(`Datei konnte nicht gespeichert werden: ${error.message}`);
    return;
  }
  const abs = path.join(/* turbopackIgnore: true */ root(), storagePath);
  await mkdir(path.dirname(abs), { recursive: true, mode: 0o700 });
  await writeFile(abs, buf, { mode: 0o600 });
}

/** Datei lesen – nur nachdem RLS bestätigt hat, dass die Version dem Nutzer gehört.
 *  Supabase: kurzlebige signierte URL (60 s) statt Dateiinhalt. */
export async function readVersion(s: Session, versionId: string): Promise<{ buf?: Buffer; url?: string; mime: string; name: string } | null> {
  const rows = await db(s).run((q) => q<{ storage_path: string; mime_type: string; scan_status: string; title: string }>(
    `select v.storage_path, v.mime_type, v.scan_status::text as scan_status, d.title
       from document_versions v join documents d on d.id = v.document_id where v.id = $1`, [versionId]));
  const r = rows[0];
  if (!r || r.scan_status !== 'clean') return null;
  if (usingSupabase()) {
    const sb = await supabaseUser();
    const { data, error } = await sb.storage.from('vault').createSignedUrl(r.storage_path, 60);
    if (error || !data) return null;
    return { url: data.signedUrl, mime: r.mime_type, name: r.title };
  }
  const abs = path.join(/* turbopackIgnore: true */ root(), r.storage_path);
  if (!abs.startsWith(root() + path.sep)) return null;
  return { buf: await readFile(abs), mime: r.mime_type, name: `${r.title}.${r.storage_path.split('.').pop()}` };
}
