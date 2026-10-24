import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { StepForm } from './step-form';

export const dynamic = 'force-dynamic';

export default async function Welcome({ searchParams }: { searchParams: Promise<{ schritt?: string }> }) {
  const s = await requireUser();
  const profile = await db(s).profile();
  if (profile.onboarding?.done) redirect('/');
  const step = Math.min(4, Math.max(1, Number((await searchParams).schritt ?? 1) || 1));
  const pct = Math.round(((step - 1) / 4) * 100);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-8">
      <div className="mb-6">
        <div className="mb-2 flex justify-between text-sm text-muted"><span>Einrichtung</span><span>{pct} %</span></div>
        <div className="h-2 rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2 rounded-full bg-sea" style={{ width: `${Math.max(4, pct)}%` }} />
        </div>
      </div>
      <StepForm step={step} profile={{ display_name: profile.display_name ?? '', timezone: profile.timezone,
        moving_date: profile.moving_date ? new Date(profile.moving_date).toISOString().slice(0, 10) : '',
        quiet_hours_start: profile.quiet_hours_start.slice(0, 5), quiet_hours_end: profile.quiet_hours_end.slice(0, 5) }} />
    </main>
  );
}
