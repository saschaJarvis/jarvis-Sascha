import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { getFx, getWeather } from '@/server/ext';
import { BottomNav, Shell, TopBar } from '@/components/bottom-nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser();
  const profile = await db(s).profile();
  if (!profile?.onboarding?.done) redirect('/willkommen');
  const [weather, fx] = await Promise.all([getWeather(profile.timezone), getFx()]);
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
    </div>
  );
}
