import Link from 'next/link';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { FOLDERS, FOLDER_LABEL, type Folder } from '@/server/storage';
import { PageTitle, Section } from '@/components/ui';
import { UploadForm } from './upload-form';

const STATE: Record<string, string> = {
  requested: 'angefordert', uploaded: 'hochgeladen', reviewed: 'geprüft', officially_confirmed: 'offiziell bestätigt', rejected: 'abgelehnt',
};

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ ordner?: string; q?: string }> }) {
  const s = await requireUser();
  const { ordner, q } = await searchParams;
  const folder = (FOLDERS as readonly string[]).includes(ordner ?? '') ? (ordner as Folder) : null;
  const search = (q ?? '').trim().slice(0, 100);
  const docs = await db(s).run((qq) => qq<{ id: string; title: string; folder: Folder; state: string; expires_on: string | null;
      version_id: string | null; scan_status: string | null; mime_type: string | null; created_at: Date; is_demo: boolean }>(
    `select d.id, d.title, d.folder, d.state::text as state, d.expires_on, d.created_at, d.is_demo,
            v.id as version_id, v.scan_status::text as scan_status, v.mime_type
       from documents d
       left join lateral (select * from document_versions where document_id = d.id order by version_no desc limit 1) v on true
      where d.deleted_at is null and ($1::text is null or d.folder = $1) and ($2 = '' or d.title ilike '%' || $2 || '%')
      order by d.created_at desc limit 200`, [folder, search]));

  return (
    <div>
      <PageTitle back={{ href: '/leben', label: 'Leben' }} title="Dokumente" />
      <form className="mb-3"><label className="sr-only" htmlFor="q">Suchen</label>
        <input id="q" name="q" defaultValue={search} placeholder="Suchen …" className="field" />{folder && <input type="hidden" name="ordner" value={folder} />}</form>
      <div className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4 pb-1">
        <Link href="/leben/dokumente" className={`chip shrink-0 px-3 py-1.5 ${!folder ? 'bg-sea text-sea-ink' : 'chip-detected'}`}>Alle</Link>
        {FOLDERS.map((f) => (
          <Link key={f} href={`/leben/dokumente?ordner=${f}`} className={`chip shrink-0 px-3 py-1.5 ${folder === f ? 'bg-sea text-sea-ink' : 'chip-detected'}`}>{FOLDER_LABEL[f]}</Link>
        ))}
      </div>

      <UploadForm defaultFolder={folder ?? 'other'} folders={FOLDERS.map((f) => [f, FOLDER_LABEL[f]])} />

      <Section title={`${docs.length} Dokument${docs.length === 1 ? '' : 'e'}`}>
        <ul className="grid gap-2">
          {docs.map((d) => (
            <li key={d.id} className="card flex items-center justify-between gap-3">
              <span className="min-w-0">
                {d.version_id && d.scan_status === 'clean'
                  ? <a href={`/api/datei/${d.version_id}`} className="block truncate font-semibold underline">{d.title}</a>
                  : <span className="block truncate font-semibold">{d.title}</span>}
                <span className="text-sm text-muted">{FOLDER_LABEL[d.folder]} · {STATE[d.state]}{d.expires_on ? ` · läuft ab ${new Date(d.expires_on).toLocaleDateString('de-DE')}` : ''}</span>
              </span>
              {d.scan_status && d.scan_status !== 'clean' && <span className="chip chip-inferred shrink-0">{d.scan_status === 'infected' ? 'gesperrt' : 'wird geprüft'}</span>}
            </li>
          ))}
        </ul>
        {docs.length === 0 && <p className="text-muted">Noch keine Dokumente{folder ? ' in diesem Ordner' : ''}.</p>}
      </Section>
      <p className="mt-6 text-xs text-muted">Hochladen heißt nicht „rechtlich erledigt“. Dateien liegen privat und werden vor dem Öffnen geprüft (Entwicklungs-Scanner – in Produktion durch einen echten Virenscanner ersetzt).</p>
    </div>
  );
}
