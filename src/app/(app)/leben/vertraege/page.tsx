import Link from 'next/link';
import { requireUser } from '@/server/auth';
import { db } from '@/server/repo';
import { PageTitle, Section } from '@/components/ui';
import { CANCELLATION_STEPS_DE } from '@/lib/domain/cancellationStateMachine';
import { createDemoContractAction } from './actions';
import { NewContractForm } from './new-contract-form';
import { CATEGORY_LABEL } from '@/lib/labels';


export default async function ContractsPage() {
  const s = await requireUser();
  const rows = await db(s).run((q) => q<{ id: string; name: string; category: string; is_demo: boolean; status: string | null }>(
    `select c.id, c.name, c.category, c.is_demo,
       (select status::text from cancellation_requests r where r.contract_id = c.id and r.deleted_at is null order by created_at desc limit 1) as status
     from contracts c where c.deleted_at is null order by c.is_demo, c.created_at desc`));
  const label = (st: string | null) => CANCELLATION_STEPS_DE.find((x) => x.status === st)?.label ?? st;
  return (
    <div>
      <PageTitle back={{ href: '/leben', label: 'Leben' }} title="Verträge & Kündigungen" />
      <ul className="grid gap-2">
        {rows.map((c) => (
          <li key={c.id}>
            <Link href={`/leben/vertraege/${c.id}`} className="card flex items-center justify-between gap-3">
              <span><span className="block font-semibold">{c.name}</span><span className="text-sm text-muted">{CATEGORY_LABEL[c.category]}{c.status ? ` · Kündigung: ${label(c.status)}` : ''}</span></span>
              {c.is_demo && <span className="chip chip-demo">Beispiel</span>}
            </Link>
          </li>
        ))}
      </ul>
      {!rows.some((r) => r.is_demo) && (
        <form action={createDemoContractAction} className="mt-3">
          <button className="btn btn-secondary w-full">Beispiel ansehen: Büromietvertrag Mainz</button>
        </form>
      )}
      <Section title="Vertrag erfassen"><NewContractForm labels={CATEGORY_LABEL} /></Section>
    </div>
  );
}
