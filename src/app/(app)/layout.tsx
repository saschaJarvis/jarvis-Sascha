import { redirect } from 'next/navigation';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { BottomNav } from '@/components/bottom-nav';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser();
  const profile = await db(s).profile();
  if (!profile?.onboarding?.done) redirect('/willkommen');
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <main className="px-4 pb-32 pt-6" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>{children}</main>
      <BottomNav />
    </div>
  );
}
