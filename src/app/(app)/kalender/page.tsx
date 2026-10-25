import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { PageTitle } from '@/components/ui';
import { WeekCalendar } from '@/components/week-calendar';
import { buildCalendar } from '@/lib/calendar';
import { DOMAIN_LABEL } from '@/lib/labels';

export default async function CalendarPage() {
  const s = await requireUser();
  const [profile, open] = await Promise.all([db(s).profile(), db(s).openTasks()]);
  const weeks = buildCalendar(open, profile.timezone, new Date(), 2, 12);
  return (
    <div>
      <PageTitle title="Kalender" />
      <WeekCalendar weeks={weeks} domainLabel={DOMAIN_LABEL} />
      <p className="mt-3 text-xs text-muted">Zeigt deine offenen Aufgaben mit Frist. Externe Kalender (Google, Outlook, iPhone) sind noch nicht verbunden.</p>
    </div>
  );
}
