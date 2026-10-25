import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { PageTitle, Section } from '@/components/ui';
import { aiConsentAction, killSwitchAction, requestDeletionAction, resumeAction } from './actions';
import { AI_CONSENT, claudeAvailable, CLAUDE_MODEL } from '@/server/claude';
import { SettingsForm } from './settings-form';
import { logoutAction } from '@/app/(auth)/actions';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ geloescht?: string }> }) {
  const s = await requireUser();
  const { geloescht } = await searchParams;
  const profile = await db(s).profile();
  const consents = await db(s).run((q) => q<{ purpose: string; granted: boolean }>(
    `select distinct on (purpose) purpose, granted from consent_records where user_id = auth.uid() and purpose like 'notify.%'
     order by purpose, created_at desc, id desc`));
  const granted = new Set(consents.filter((c) => c.granted).map((c) => c.purpose.replace('notify.', '')));
  const deletion = await db(s).run((q) => q<{ execute_after: Date }>('select execute_after from deletion_requests where cancelled_at is null and executed_at is null limit 1'));
  const ai = await db(s).run(async (q) => (await q<{ ok: boolean }>('select app.has_consent(auth.uid(), $1) as ok', [AI_CONSENT]))[0].ok);
  const paused = profile.paused_until && new Date(profile.paused_until) > new Date();

  return (
    <div>
      <PageTitle back={{ href: '/leben', label: 'Leben' }} title="Einstellungen" />
      {geloescht && <p className="notice notice-warn mb-4">Löschung beantragt. Alle automatischen Aktionen sind gestoppt.</p>}

      <SettingsForm profile={{
        display_name: profile.display_name ?? '', timezone: profile.timezone,
        quiet_hours_start: profile.quiet_hours_start.slice(0, 5), quiet_hours_end: profile.quiet_hours_end.slice(0, 5),
        max_notifications_per_day: profile.max_notifications_per_day,
      }} channels={[...granted]} />

      <Section title="Ruhe">
        <div className="card grid gap-3">
          {paused ? (
            <form action={resumeAction}><p className="mb-2">Erinnerungen sind pausiert.</p><button className="btn btn-secondary w-full">Pause beenden</button></form>
          ) : <p className="text-muted">Pausieren geht jederzeit über „Zu viel?“ auf der Startseite.</p>}
          <form action={killSwitchAction}>
            <input type="hidden" name="on" value={profile.kill_switch ? 'false' : 'true'} />
            <p className="mb-2"><strong>Notaus:</strong> {profile.kill_switch ? 'AN – Jarvis tut nichts automatisch.' : 'aus'}</p>
            <button className={`btn w-full ${profile.kill_switch ? 'btn-secondary' : 'btn-danger'}`}>{profile.kill_switch ? 'Notaus aufheben' : 'Alles Automatische sofort stoppen'}</button>
          </form>
        </div>
      </Section>

      <Section title="Claude (KI)">
        <div className="card grid gap-2 text-sm">
          <p>Status: <strong>{claudeAvailable() ? `verbunden (${CLAUDE_MODEL()})` : 'nicht verbunden – API-Schlüssel fehlt'}</strong></p>
          <p className="text-muted">Mit deiner Zustimmung liest Claude hochgeladene Dokumente zum Sortieren und beantwortet Fragen im Jarvis-Reiter anhand einer Übersicht deiner Daten. Claude kann nichts senden, kündigen oder bezahlen; Vorschläge landen im Eingang.</p>
          <form action={aiConsentAction}>
            <input type="hidden" name="on" value={ai ? 'false' : 'true'} />
            <p className="mb-2">Zustimmung: <strong>{ai ? 'erteilt' : 'nicht erteilt'}</strong></p>
            <button className="btn btn-secondary w-full">{ai ? 'Zustimmung widerrufen' : 'Zustimmen'}</button>
          </form>
        </div>
      </Section>

      <Section title="Sicherheit">
        <div className="card grid gap-2 text-sm">
          <p>✓ Anmeldung mit Passwort + Authenticator-Code (Pflicht)</p>
          <p>✓ Freigaben, Export und Löschung verlangen einen frischen Code</p>
          <p className="text-muted">Passkeys: geplant.</p>
          <form action={logoutAction}><button className="btn btn-secondary mt-2 w-full">Abmelden</button></form>
        </div>
      </Section>

      <Section title="Deine Daten">
        <div className="card grid gap-3" id="loeschen">
          <a href="/api/export" className="btn btn-secondary w-full">Alle Daten herunterladen (JSON)</a>
          {deletion[0] ? (
            <p className="notice notice-warn">Löschung geplant ab {new Date(deletion[0].execute_after).toLocaleDateString('de-DE')}. Bis dahin kannst du dich melden, um sie abzubrechen.</p>
          ) : (
            <form action={requestDeletionAction}>
              <p className="mb-2 text-sm text-muted">Löscht nach 7 Tagen Bedenkzeit dein Konto und alle Dateien.</p>
              <button className="btn btn-danger w-full">Konto löschen beantragen</button>
            </form>
          )}
        </div>
      </Section>
    </div>
  );
}
