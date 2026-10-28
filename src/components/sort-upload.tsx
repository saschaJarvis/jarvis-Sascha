'use client';
import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { moveDocumentAction, sortUploadAction } from '@/app/(app)/leben/dokumente/sort-actions';

const FOLDER_OPTIONS: Array<[string, string]> = [
  ['identity', 'Ausweise'], ['visa', 'Visum'], ['uae_property', 'Dubai-Wohnung'], ['housing', 'Wohnung'], ['office', 'Büro'],
  ['storage', 'Lager'], ['business', 'Firma'], ['taxes', 'Steuern'], ['banks', 'Banken'], ['insurance', 'Versicherungen'],
  ['subscriptions', 'Abos'], ['shipping', 'Versand/Umzug'], ['customs', 'Zoll'], ['utilities', 'Strom/Wasser'],
  ['healthcare', 'Gesundheit'], ['vehicles', 'Fahrzeuge'], ['travel', 'Reisen'], ['legal', 'Rechtliches'], ['crypto', 'Krypto'], ['other', 'Sonstiges'],
];

/** Großer Knopf: Datei(en) wählen oder fotografieren → Jarvis/Claude liest, benennt, sortiert, schlägt Aufgaben vor. */
export function SortUpload({ claude, consented }: { claude: boolean; consented: boolean }) {
  const [state, action] = useActionState(sortUploadAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [names, setNames] = useState<string[]>([]);

  return (
    <section aria-label="Hochladen und sortieren" className="grid gap-3">
      <form ref={formRef} action={action} className="grid gap-2">
        <label htmlFor="sort-files"
          className="group relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-sea/70 bg-sea-soft/40 px-4 py-4 text-center transition hover:bg-sea-soft/70 hover:shadow-[0_0_24px_rgba(63,210,255,.18)]">
          <span className="mono text-[.95rem] font-semibold uppercase tracking-[.22em] text-sea glow">⬆ Hochladen & sortieren</span>
          <span className="text-sm text-muted">
            {names.length ? names.join(', ') : 'Foto, Scan oder PDF – Jarvis liest, benennt und legt es in den richtigen Ordner.'}
          </span>
          <input id="sort-files" name="files" type="file" multiple required className="sr-only"
            accept="application/pdf,image/jpeg,image/png,image/heic,.csv,.xlsx,.eml"
            onChange={(e) => {
              const list = Array.from(e.currentTarget.files ?? []);
              setNames(list.map((f) => f.name));
              if (list.length && (consented || !claude)) formRef.current?.requestSubmit();
            }} />
        </label>
        {claude && !consented && (
          <div className="grid gap-2">
            <label className="flex items-start gap-2 text-sm text-muted">
              <input type="checkbox" name="consent" className="mt-1 h-4 w-4 accent-[#3fd2ff]" />
              <span>Einverstanden: Hochgeladene Dokumente werden zum Lesen an Claude (Anthropic) gesendet. Jarvis speichert nur Titel, Ordner und Zusammenfassung; Claude kann nichts senden oder bezahlen. Widerruf jederzeit in den Einstellungen.</span>
            </label>
            {names.length > 0 && <SortButton />}
          </div>
        )}
        {!claude && <p className="mono text-[.62rem] uppercase tracking-widest text-muted">Claude noch nicht verbunden – Einordnung nur nach Dateiname</p>}
        <Pending />
      </form>

      {state?.error && <p role="alert" className="notice notice-bad">{state.error}</p>}
      {state?.note && <p className="notice notice-info text-sm">{state.note}</p>}
      {state?.results && (
        <ul className="grid gap-2" aria-live="polite">
          {state.results.map((r, i) => (
            <li key={`${r.name}-${i}`} className={`border px-3 py-2.5 ${r.ok ? 'border-line bg-card/70' : 'border-bad bg-bad-soft'}`}>
              {r.ok ? (
                <div className="grid gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={`/leben/dokumente?ordner=${r.folder}`} className="font-semibold">{r.title}</Link>
                    <span className="mono text-[.66rem] uppercase tracking-widest text-sea">→ {r.folderLabel}</span>
                  </div>
                  <p className="text-sm text-muted">{r.summary}</p>
                  <p className="mono flex flex-wrap gap-3 text-[.64rem] uppercase tracking-wider text-muted">
                    {r.issuer && <span>Von: <b className="text-ink">{r.issuer}</b></span>}
                    {r.amount && <span>Betrag: <b className="text-ink">{r.amount}</b></span>}
                    {r.byClaude && <span className="text-sea">gelesen von Claude</span>}
                    {!!r.tasks && <Link href="/eingang" className="text-warn underline">{r.tasks} Aufgabe{r.tasks > 1 ? 'n' : ''} im Eingang prüfen</Link>}
                    {r.duplicateOf && <span className="text-warn">schon vorhanden als „{r.duplicateOf}“</span>}
                    {r.contract && <Link href={`/leben/vertraege/${r.contract.contractId}`} className="text-sea underline">{r.contract.created ? 'Neuer Vertrag' : 'Vertrag ergänzt'}: {r.contract.name}</Link>}
                  </p>
                  <form action={moveDocumentAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={r.documentId} />
                    <label className="sr-only" htmlFor={`mv-${i}`}>Ordner ändern</label>
                    <select id={`mv-${i}`} name="folder" defaultValue={r.folder} className="field min-h-9 flex-1 py-1 text-sm">
                      {FOLDER_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button className="btn btn-secondary min-h-9 px-3 text-[.66rem]">Stimmt so / Verschieben</button>
                  </form>
                </div>
              ) : <p className="text-sm"><b>{r.name}:</b> {r.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SortButton() {
  const { pending } = useFormStatus();
  return <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Jarvis liest …' : 'Sortieren'}</button>;
}

function Pending() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <p role="status" className="mono flex items-center justify-center gap-2 text-[.72rem] uppercase tracking-widest text-sea">
      <span className="blink inline-block h-2 w-2 bg-sea" /> Jarvis liest und sortiert …
    </p>
  );
}
