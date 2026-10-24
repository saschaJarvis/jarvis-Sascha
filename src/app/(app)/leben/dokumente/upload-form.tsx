'use client';
import { useActionState, useEffect, useRef } from 'react';
import { uploadDocumentAction } from './actions';
import { ErrorNote, OkNote, Submit } from '@/components/form';

export function UploadForm({ defaultFolder, folders }: { defaultFolder: string; folders: Array<[string, string]> }) {
  const [state, action] = useActionState(uploadDocumentAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <details className="card" open={false}>
      <summary className="cursor-pointer text-lg font-semibold text-sea">+ Dokument hochladen</summary>
      <form ref={ref} action={action} className="mt-4 grid gap-3">
        <div><label className="label" htmlFor="title">Name</label><input id="title" name="title" required minLength={2} maxLength={200} className="field" placeholder="z. B. Mietvertrag Büro" /></div>
        <div><label className="label" htmlFor="folder">Ordner</label>
          <select id="folder" name="folder" defaultValue={defaultFolder} className="field">{folders.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="label" htmlFor="file">Datei (PDF, Foto, CSV, XLSX, E-Mail)</label>
          <input id="file" name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/heic,.csv,.xlsx,.eml" className="field" /></div>
        <Submit>Hochladen</Submit>
        <ErrorNote error={state?.error} /><OkNote message={state?.ok} />
      </form>
    </details>
  );
}
