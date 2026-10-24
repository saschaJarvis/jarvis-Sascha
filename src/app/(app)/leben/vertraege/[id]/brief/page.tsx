import { notFound } from 'next/navigation';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';

export default async function LetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const s = await requireUser();
  const r = await db(s).run(async (q) => (await q<{ draft_body: string; draft_sha256: string; status: string }>(
    `select draft_body, draft_sha256, status::text as status from cancellation_requests where contract_id = $1 and deleted_at is null order by created_at desc limit 1`, [id]))[0]);
  if (!r?.draft_body || !['APPROVED', 'SENT', 'DELIVERY_EVIDENCE', 'CONFIRMED', 'CLOSED'].includes(r.status)) notFound();
  return (
    <div>
      <style>{`@media print { nav, .no-print { display: none !important } body { background: #fff } main { padding: 0 !important } }`}</style>
      <p className="no-print notice notice-info mb-4">Über „Teilen → Drucken“ ausdrucken, eigenhändig unterschreiben, Kopie behalten.</p>
      <article className="mx-auto max-w-[42rem] whitespace-pre-wrap bg-white p-8 font-serif text-[11pt] leading-relaxed text-black">{r.draft_body}</article>
      <p className="no-print mt-3 text-xs text-muted">Freigegebene Fassung · Prüfsumme {r.draft_sha256.slice(0, 16)}</p>
    </div>
  );
}
