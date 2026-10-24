'use client';
import { useActionState, useState } from 'react';
import { evidenceNoteAction, evidenceUploadAction } from '../actions';
import { ErrorNote, OkNote, Submit } from '@/components/form';

export function EvidenceForms({ id }: { id: string }) {
  const [mode, setMode] = useState<'file' | 'note' | 'not_available'>('file');
  const [upState, upload] = useActionState(evidenceUploadAction, undefined);
  const [noteState, note] = useActionState(evidenceNoteAction, undefined);
  return (
    <div className="card grid gap-3">
      <div role="tablist" className="flex flex-wrap gap-1 text-sm">
        {([['file', 'Datei/Foto'], ['note', 'Notiz'], ['not_available', 'Gibt es nicht']] as const).map(([m, l]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={`chip px-3 py-1.5 ${mode === m ? 'bg-sea text-sea-ink' : 'chip-detected'}`}>{l}</button>
        ))}
      </div>
      {mode === 'file' ? (
        <form action={upload} className="grid gap-3">
          <input type="hidden" name="id" value={id} />
          <label className="label" htmlFor="file">Foto oder PDF</label>
          <input id="file" name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/heic,.csv,.xlsx,.eml" className="field" />
          <Submit>Hochladen</Submit>
          <ErrorNote error={upState?.error} /><OkNote message={upState?.ok} />
        </form>
      ) : (
        <form action={note} className="grid gap-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="kind" value={mode} />
          <label className="label" htmlFor="note">{mode === 'note' ? 'Was ist erledigt? (z. B. Maße, Datum, Name)' : 'Warum gibt es keinen Nachweis?'}</label>
          <textarea id="note" name="note" rows={3} required minLength={3} className="field" />
          <Submit>Speichern</Submit>
          <ErrorNote error={noteState?.error} /><OkNote message={noteState?.ok} />
        </form>
      )}
    </div>
  );
}
