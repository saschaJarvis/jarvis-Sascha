import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { getFx, getWeather } from '@/server/ext';
import { BottomNav, Shell, TopBar } from '@/components/bottom-nav';
import { JarvisDock } from '@/components/jarvis-dock';
import { AI_CONSENT, claudeAvailable } from '@/server/claude';

export const dynamic = 'force-dynamic';
// Kontoauszug-Auswertung läuft nach der Antwort (after()) und braucht bei langen Auszügen 1–3 Minuten
export const maxDuration = 300;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser();
  const profile = await db(s).profile();
  if (!profile?.onboarding?.done) redirect('/willkommen');
  const [weather, fx, consent] = await Promise.all([getWeather(profile.timezone), getFx(),
    db(s).run(async (q) => (await q<{ ok: boolean }>('select app.has_consent(auth.uid(), $1) as ok', [AI_CONSENT]))[0].ok).catch(() => false)]);
  const ambient = {
    weather: weather ? `${weather.place} ${weather.tempC} °C${weather.label ? ` · ${weather.label}` : ''}` : null,
    fx: fx ? `1 € = ${fx.eurAed.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} AED` : null,
    fxTitle: fx ? `${fx.source}, Stand ${fx.date}` : undefined,
  };
  return (
    <div className="min-h-dvh">
      <TopBar ambient={ambient} />
      <Shell>{children}</Shell>
      <BottomNav />
      <JarvisDock available={claudeAvailable()} consented={consent} />
    </div>
  );
}
