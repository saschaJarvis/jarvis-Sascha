import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { loadExternalEvents } from '@/server/calendars';
import { PageTitle, Section } from '@/components/ui';
import { WeekCalendar } from '@/components/week-calendar';
import { buildCalendar } from '@/lib/calendar';
import { DOMAIN_LABEL } from '@/lib/labels';
import { ConnectCalendarForm, ConnectSection } from './connect-form';
import { removeCalendarAction } from './actions';

const PROVIDER: Record<string, string> = { icloud: 'iPhone / iCloud', google: 'Google', outlook: 'Outlook' };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ verbinden?: string }> }) {
  const s = await requireUser();
  const { verbinden } = await searchParams;
  const now = new Date();
  const [profile, open, ext] = await Promise.all([
    db(s).profile(), db(s).openTasks(),
    loadExternalEvents(s, new Date(now.getTime() - 15 * 86_400_000), new Date(now.getTime() + 13 * 7 * 86_400_000)),
  ]);
  const weeks = buildCalendar(open, profile.timezone, now, 2, 12, ext.events);
  const none = ext.sources.length === 0;

  return (
    <div>
      <PageTitle title="Kalender" />
      <WeekCalendar weeks={weeks} domainLabel={DOMAIN_LABEL} hasSources={!none} />

      <Section title="Verbundene Kalender">
        {ext.sources.length > 0 && (
          <ul className="mb-3 grid gap-2">
            {ext.sources.map((c) => (
              <li key={c.id} className="card flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{c.name} <span className="mono text-[.62rem] uppercase tracking-widest text-muted">· {PROVIDER[c.provider] ?? c.provider}</span></span>
                  <span className={`mono block text-[.66rem] ${c.ok ? 'text-good' : 'text-bad'}`}>{c.ok ? `● verbunden · ${c.count} Termine im Zeitraum` : `● ${c.error}`}</span>
                  <span className="mono block truncate text-[.6rem] text-muted">{c.hint}</span>
                </span>
                <form action={removeCalendarAction}><input type="hidden" name="id" value={c.id} /><button className="btn btn-secondary min-h-9 px-3 text-[.66rem]">Trennen</button></form>
              </li>
            ))}
          </ul>
        )}
        <ConnectSection initialOpen={none || verbinden === '1'} title={none ? 'iPhone-Kalender verbinden' : '+ Weiteren Kalender verbinden'}>
          <div className="mt-3 grid gap-4">
            <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
              <li>Auf dem iPhone die App <b>Kalender</b> öffnen und unten auf <b>Kalender</b> tippen.</li>
              <li>Beim gewünschten Kalender (unter <b>iCloud</b>) rechts auf das <b>ⓘ</b> tippen.</li>
              <li>Ganz unten <b>Öffentlicher Kalender</b> einschalten.</li>
              <li><b>Link teilen …</b> → <b>Kopieren</b>.</li>
              <li>Hier unten einfügen und auf <b>Kalender verbinden</b> tippen.</li>
            </ol>
            <p className="notice notice-info text-sm">
              Gut zu wissen: Jarvis liest nur – er kann keine Termine ändern. Der Link ist wie ein Schlüssel: Wer ihn kennt, kann diesen Kalender
              ansehen. Jarvis zeigt ihn deshalb nie vollständig an. Termine aus Kalendern „Auf meinem iPhone“ (nicht iCloud) lassen sich nicht teilen.
              Google: Einstellungen → Kalender → „Privatadresse im iCal-Format“. Outlook: Kalender veröffentlichen → ICS-Link.
            </p>
            <ConnectCalendarForm />
          </div>
        </ConnectSection>
      </Section>
    </div>
  );
}
