import Link from 'next/link';
import { statementGap, type StatementRow } from '@/server/statements';

const nf = (n: number, d = 2) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = (minor: string | number | null | undefined, cur = 'EUR', d = 2) => (minor == null ? '–' : `${nf(Number(minor) / 100, d)} ${cur === 'EUR' ? '€' : cur}`);
const signed = (minor: number, cur = 'EUR', d = 0) => `${minor > 0 ? '+' : minor < 0 ? '−' : '±'}${eur(Math.abs(minor), cur, d)}`;
const month = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
const day = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'UTC' }) : '');

const isPlaceholder = (r: StatementRow) => Number(r.opening_minor) === 0 && Number(r.closing_minor) === 0 && Number(r.in_minor) === 0 && Number(r.out_minor) === 0;

/** Je Konto der neueste echte Auszug (Platzhalter ohne Salden zählen nicht). */
function latestPerAccount(rows: StatementRow[]): StatementRow[] {
  const by = new Map<string, StatementRow>();
  for (const r of rows) {
    if (r.status !== 'done' || isPlaceholder(r)) continue;
    const k = r.account_name ?? r.bank ?? '?';
    const cur = by.get(k);
    if (!cur || (r.period_to ?? '') > (cur.period_to ?? '')) by.set(k, r);
  }
  return [...by.values()].sort((a, b) => (b.period_to ?? '').localeCompare(a.period_to ?? ''));
}

/** Kurzzeilen für die Brücke: je Konto der letzte ausgewertete Auszug. */
export function StatementLine({ rows }: { rows: StatementRow[] }) {
  const busy = rows.filter((r) => r.status === 'processing' || r.status === 'pending').length;
  const last = latestPerAccount(rows).slice(0, 4);
  if (!last.length && !busy) return null;
  return (
    <Link href="/leben/finanzen#kontoauszuege" className="grid gap-1.5 border-l-2 border-sea pl-2 text-sm">
      <span className="mono block text-[.62rem] uppercase tracking-[.16em] text-muted">Kontoauszüge</span>
      {last.map((r) => (
        <span key={r.id} className="block">
          <span className="text-xs text-muted">{r.account_name ?? r.bank} · {month(r.period_to)}</span>
          <span className="hud-num block">
            <span className="text-good">+{eur(r.in_minor, r.currency ?? 'EUR', 0)}</span>
            {' · '}<span className="text-bad">−{eur(r.out_minor, r.currency ?? 'EUR', 0)}</span>
            {' · '}Stand {eur(r.closing_minor, r.currency ?? 'EUR', 0)}
          </span>
        </span>
      ))}
      {busy > 0 && <span className="block text-xs text-warn">{busy === 1 ? '1 Auszug wird' : `${busy} Auszüge werden`} gerade ausgewertet …</span>}
    </Link>
  );
}

/** Abschnitt „Kontoauszüge“ unter Finanzen. */
export function StatementsSection({ rows, claude }: { rows: StatementRow[]; claude: boolean }) {
  const done = rows.filter((r) => r.status === 'done');
  const open = rows.filter((r) => r.status !== 'done');
  // je Konto getrennt (verschiedene Banken/Währungen nie zusammenrechnen)
  const groups = new Map<string, StatementRow[]>();
  for (const r of done) {
    const k = r.account_name ?? r.bank ?? 'Konto';
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const ordered = [...groups.entries()].sort((a, b) => (b[1][0].period_to ?? '').localeCompare(a[1][0].period_to ?? ''));

  return (
    <div className="grid gap-3">
      {open.map((r) => (
        <p key={r.id} className={`notice ${r.status === 'error' ? 'notice-warn' : 'notice-info'} text-sm`}>
          {r.status === 'error'
            ? <>„{r.title}“ konnte nicht ausgewertet werden ({r.error ?? 'Fehler'}).{r.attempts < 3 ? ' Jarvis versucht es beim nächsten Öffnen erneut.' : ' Bitte den Auszug neu hochladen.'}</>
            : <>„{r.title}“ wird gerade von Claude ausgewertet … (1–3 Minuten, die Seite aktualisiert sich selbst)</>}
        </p>
      ))}

      {done.length === 0 && open.length === 0 && (
        <div className="card grid gap-2">
          <p className="text-muted">{claude ? 'Noch kein Kontoauszug ausgewertet. Lade einen Auszug (PDF) über „Hochladen & sortieren“ hoch – Jarvis wertet ihn automatisch aus und trägt den Kontostand hier ein.' : 'Claude ist nicht verbunden – Kontoauszüge werden noch nicht ausgewertet.'}</p>
        </div>
      )}

      {ordered.map(([name, list]) => <AccountGroup key={name} name={name} list={list} />)}
      <p className="notice notice-info text-sm">Jarvis fragt nie nach Bank-Passwörtern. Neue Auszüge einfach als PDF hochladen – sie werden automatisch ausgewertet und der Kontostand übernommen.</p>
    </div>
  );
}

function AccountGroup({ name, list }: { name: string; list: StatementRow[] }) {
  const sorted = [...list].sort((a, b) => (b.period_to ?? '').localeCompare(a.period_to ?? '') || (isPlaceholder(a) ? 1 : -1));
  const real = sorted.filter((r) => !isPlaceholder(r));
  const trend = [...real].filter((r) => r.closing_minor != null).reverse();
  const cur = real[0]?.currency ?? sorted[0].currency ?? 'EUR';
  const max = Math.max(1, ...trend.map((r) => Math.abs(Number(r.closing_minor))));
  const sumIn = real.reduce((n, r) => n + Number(r.in_minor ?? 0), 0);
  const sumOut = real.reduce((n, r) => n + Number(r.out_minor ?? 0), 0);
  return (
    <div className="grid gap-2">
      <p className="eyebrow">{name}{real[0] ? ` · Stand ${eur(real[0].closing_minor, cur, 0)} (${day(real[0].period_to)})` : ''}</p>
      {trend.length > 1 && (
        <div className="card grid gap-2">
          <div className="flex h-24 items-end gap-2" role="img" aria-label={trend.map((r) => `${month(r.period_to)}: ${eur(r.closing_minor, cur, 0)}`).join(', ')}>
            {trend.map((r) => (
              <div key={r.id} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="hud-num text-[.62rem] text-muted">{nf(Number(r.closing_minor) / 100_000, 0)} T</span>
                <span className={`w-full ${Number(r.closing_minor) < 0 ? 'bg-bad' : 'bg-sea'}`} style={{ height: `${Math.max(3, (Math.abs(Number(r.closing_minor)) / max) * 70)}px` }} />
                <span className="mono text-[.6rem] uppercase text-muted">{r.period_to ? new Date(`${r.period_to}T12:00:00Z`).toLocaleDateString('de-DE', { month: 'short', timeZone: 'UTC' }) : ''}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted">
            {real.length} Auszüge: <span className="text-good">+{eur(sumIn, cur, 0)}</span> · <span className="text-bad">−{eur(sumOut, cur, 0)}</span>
            {' · '}Veränderung {signed(Number(trend[trend.length - 1].closing_minor) - Number(trend[0].opening_minor ?? trend[0].closing_minor), cur)}
          </p>
        </div>
      )}
      <ul className="grid gap-3">
        {sorted.map((r, i) => isPlaceholder(r)
          ? <li key={r.id} className="card text-sm text-muted">{month(r.period_to)}: keine Buchungen im Zeitraum ({day(r.period_from)} – {day(r.period_to)}).</li>
          : <StatementCard key={r.id} r={r} openByDefault={i === 0} />)}
      </ul>
    </div>
  );
}

function StatementCard({ r, openByDefault }: { r: StatementRow; openByDefault: boolean }) {
  const cur = r.currency ?? 'EUR';
  const delta = Number(r.closing_minor) - Number(r.opening_minor);
  const gap = statementGap(r);
  const a = r.analysis ?? {};
  const outCats = (a.categories ?? []).filter((c) => c.direction === 'out').sort((x, y) => y.amount - x.amount);
  const inCats = (a.categories ?? []).filter((c) => c.direction === 'in').sort((x, y) => y.amount - x.amount);
  const outTotal = outCats.reduce((n, c) => n + c.amount, 0) || 1;

  return (
    <li className="card grid gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{month(r.period_to)}</p>
          <p className="text-xs text-muted">{[r.account_name ?? r.bank, r.statement_no ? `Auszug ${r.statement_no}` : null, `${day(r.period_from)} – ${day(r.period_to)}`].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="text-right">
          <p className="hud-num text-lg font-bold">{eur(r.closing_minor, cur)}</p>
          <p className={`hud-num text-sm ${delta > 0 ? 'text-good' : delta < 0 ? 'text-bad' : 'text-muted'}`}>{signed(delta, cur)} im Monat</p>
        </div>
      </div>
      <p className="hud-num text-sm"><span className="text-good">+{eur(r.in_minor, cur)}</span> Eingänge · <span className="text-bad">−{eur(r.out_minor, cur)}</span> Ausgänge</p>

      {outCats.length > 0 && (
        <div className="grid gap-1">
          <div className="flex h-2 gap-[2px]" aria-hidden="true">
            {outCats.map((c, i) => <span key={c.category} className={['bg-sea', 'bg-warn', 'bg-bad', 'bg-good', 'bg-muted'][Math.min(i, 4)]} style={{ width: `${(c.amount / outTotal) * 100}%`, opacity: i > 4 ? 0.5 : 1 }} />)}
          </div>
        </div>
      )}

      <details open={openByDefault}>
        <summary className="cursor-pointer text-sm text-sea">Auswertung</summary>
        <div className="mt-2 grid gap-3 text-sm">
          {a.summary && <p>{a.summary}</p>}

          {outCats.length > 0 && <CatTable title="Ausgaben nach Art" cats={outCats} total={outTotal} cur={cur} tone="text-bad" />}
          {inCats.length > 0 && <CatTable title="Eingänge nach Art" cats={inCats} total={inCats.reduce((n, c) => n + c.amount, 0) || 1} cur={cur} tone="text-good" />}

          {(a.largest ?? []).length > 0 && (
            <div>
              <p className="eyebrow mb-1">Größte Buchungen</p>
              <ul className="grid gap-1">
                {a.largest!.map((t, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2 border-b border-line pb-1 last:border-0">
                    <span className="min-w-0"><span className="font-semibold">{t.counterparty}</span>
                      <span className="block text-xs text-muted">{day(t.date)} · {t.category}{t.purpose ? ` · ${t.purpose}` : ''}</span></span>
                    <span className={`hud-num shrink-0 ${t.amount < 0 ? 'text-bad' : 'text-good'}`}>{signed(Math.round(t.amount * 100), cur, 2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(a.recurring ?? []).length > 0 && (
            <div>
              <p className="eyebrow mb-1">Wiederkehrende Zahlungen</p>
              <ul className="grid gap-1">
                {a.recurring!.map((t, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0">{t.counterparty} <span className="text-xs text-muted">· {t.what}{t.rhythm ? ` · ${t.rhythm}` : ''}</span></span>
                    <span className="hud-num shrink-0">{signed(Math.round(t.amount * 100), cur, 2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(a.notes ?? []).length > 0 && (
            <div className="notice notice-warn grid gap-1">
              <p className="font-semibold">Auffällig</p>
              <ul className="list-disc pl-5">{a.notes!.map((n, i) => <li key={i}>{n}</li>)}</ul>
            </div>
          )}

          <p className="text-xs text-muted">
            Alter Saldo {eur(r.opening_minor, cur)} → neuer Saldo {eur(r.closing_minor, cur)}.{' '}
            {gap == null ? '' : Math.abs(gap) <= 1 ? 'Rechenprobe stimmt.' : <span className="text-warn">Rechenprobe weicht um {eur(Math.abs(gap), cur)} ab – Summen bitte mit dem Auszug vergleichen.</span>}
            {' '}Ausgewertet von Claude · <Link className="underline" href={`/leben/dokumente?ordner=banks`}>Auszug ansehen</Link>
          </p>
        </div>
      </details>
    </li>
  );
}

function CatTable({ title, cats, total, cur, tone }: { title: string; cats: NonNullable<StatementRow['analysis']['categories']>; total: number; cur: string; tone: string }) {
  return (
    <div>
      <p className="eyebrow mb-1">{title}</p>
      <ul className="grid gap-1">
        {cats.map((c) => (
          <li key={c.category} className="grid gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0">{c.category} <span className="text-xs text-muted">· {c.count}×{c.examples ? ` · ${c.examples}` : ''}</span></span>
              <span className={`hud-num shrink-0 ${tone}`}>{nf(c.amount, 2)} {cur === 'EUR' ? '€' : cur}</span>
            </div>
            <span className="h-1 bg-line"><span className="block h-1 bg-sea" style={{ width: `${Math.min(100, (c.amount / total) * 100)}%` }} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
