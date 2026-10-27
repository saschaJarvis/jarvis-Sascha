import Link from 'next/link';
import { requireUser } from '@/server/auth';
import { db, asPriorityTask } from '@/server/repo';
import { buildTodayView, scoreTask } from '@/lib/domain/priority';
import { formatDue, PageTitle } from '@/components/ui';
import { QuickCapture } from '@/components/quick-capture';
import { AI_CONSENT, claudeAvailable } from '@/server/claude';
import { JarvisChat } from './chat';
import { ttsAvailable } from '@/server/tts';

const QUESTIONS = [
  { k: 'heute', q: 'Was muss ich heute machen?' },
  { k: 'vergessen', q: 'Was vergesse ich gerade?' },
  { k: 'rechnungen', q: 'Welche Rechnungen sind offen?' },
  { k: 'dubai', q: 'Was kostet mich Dubai monatlich?' },
] as const;

export default async function JarvisPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const s = await requireUser();
  const { f } = await searchParams;
  const [profile, open, consent] = await Promise.all([db(s).profile(), db(s).openTasks(),
    db(s).run(async (q) => (await q<{ ok: boolean }>('select app.has_consent(auth.uid(), $1) as ok', [AI_CONSENT]))[0].ok)]);
  const tz = profile.timezone;
  const now = new Date();
  let answer: React.ReactNode = null;

  if (f === 'heute') {
    const v = buildTodayView(open.map(asPriorityTask), now);
    answer = v.doThisNow ? (
      <>
        <p>Heute zuerst: <Link className="font-semibold underline" href={`/aufgaben/${v.doThisNow.task.id}`}>{v.doThisNow.task.title}</Link>.</p>
        {v.doThisNow.reasons.length > 0 && <p className="text-sm text-muted">Weil: {v.doThisNow.reasons.join(', ')}.</p>}
        {v.alsoUrgent.length > 0 && <p className="mt-2">Danach, falls Kraft übrig ist: {v.alsoUrgent.map((x) => x.task.title).join(' · ')}.</p>}
      </>
    ) : <p>Heute steht nichts Dringendes an.</p>;
  } else if (f === 'vergessen') {
    const overdue = open.filter((t) => t.due_at && new Date(t.due_at) < now);
    const waiting = open.filter((t) => t.status === 'WAITING_FOR_THIRD_PARTY');
    const evidence = open.filter((t) => t.status === 'EVIDENCE_PENDING');
    const unsure = open.filter((t) => t.certainty !== 'verified');
    const items = [
      ...overdue.map((t) => ({ t, why: `Frist ${formatDue(t.due_at, tz)}` })),
      ...evidence.map((t) => ({ t, why: 'Nachweis fehlt noch' })),
      ...waiting.map((t) => ({ t, why: 'du wartest auf jemanden – nachhaken?' })),
      ...unsure.map((t) => ({ t, why: 'Angaben noch unbestätigt' })),
    ].sort((a, b) => scoreTask(asPriorityTask(b.t), now).score - scoreTask(asPriorityTask(a.t), now).score);
    answer = items.length ? (
      <ul className="grid gap-1">{items.slice(0, 8).map(({ t, why }, i) => <li key={`${t.id}-${i}`}>• <Link className="underline" href={`/aufgaben/${t.id}`}>{t.title}</Link> – {why}</li>)}</ul>
    ) : <p>Ich sehe nichts Vergessenes – aber ich kenne nur, was in Jarvis steht. E-Mails und Kalender sind noch nicht verbunden.</p>;
  } else if (f === 'rechnungen') {
    answer = <p>Dazu habe ich noch keine Belege. Sobald du Kontoauszüge hochlädst oder E-Mail verbindest, zeige ich offene Rechnungen mit Quelle. Ich rate nicht.</p>;
  } else if (f === 'dubai') {
    answer = <p>Das kann ich erst ehrlich beantworten, wenn Kaufvertrag, Zahlungsplan und Bankangebot (Zins, Laufzeit) vorliegen. Lade sie unter <Link className="underline" href="/leben/dubai">Dubai</Link> hoch – dann rechne ich mit echten Zahlen.</p>;
  }

  return (
    <div>
      <PageTitle title="Frag Jarvis" />
      {claudeAvailable() ? <JarvisChat consented={consent} cloudVoice={ttsAvailable()} /> : (
        <p className="notice notice-info">Claude ist noch nicht verbunden. Sobald der API-Schlüssel bei Vercel eingetragen ist, kannst du hier frei fragen.</p>
      )}
      <h2 className="eyebrow mt-8 mb-2">Schnellantworten ohne KI</h2>
      <div className="grid gap-2">
        {QUESTIONS.map((x) => (
          <Link key={x.k} href={`/jarvis?f=${x.k}`} className={`card font-semibold ${f === x.k ? 'border-sea' : ''}`}>{x.q}</Link>
        ))}
      </div>
      {answer && <section aria-live="polite" className="card mt-4 bg-sea-soft">{answer}</section>}
      <p className="mt-3 text-xs text-muted">Diese Antworten berechnet Jarvis selbst aus deinen Daten – ohne KI.</p>
      <h2 className="eyebrow mt-8 mb-2">Alles loswerden, was dir im Kopf herumgeht</h2>
      <QuickCapture />
    </div>
  );
}
