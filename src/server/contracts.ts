import 'server-only';
import type { Q } from './db';
import { contractColumns, matchContract, type ContractFacts, type ExistingContract } from '@/lib/domain/contractFromDocument';

export interface ContractLink { contractId: string; name: string; created: boolean }

/**
 * Hängt ein Vertragsdokument an einen bestehenden Vertrag an oder legt einen neuen an (Sicherheit „erkannt“).
 * Bestehende Angaben werden nie überschrieben, nur Lücken gefüllt. Läuft in Saschas RLS-Kontext.
 */
export async function linkContractFromDocument(q: Q, documentId: string, f: ContractFacts): Promise<ContractLink> {
  const existing = await q<ExistingContract>(
    `select id, name, category, counterparty_name, contract_number, is_demo from contracts where deleted_at is null`);
  const col = contractColumns(f);
  let id = matchContract(existing, f);
  let created = false;

  if (id) {
    await q(
      `update contracts set
         counterparty_name    = coalesce(counterparty_name, $2),
         counterparty_address = coalesce(counterparty_address, $3),
         contract_number      = coalesce(contract_number, $4),
         start_date           = coalesce(start_date, $5::date),
         notice_period_certainty = case when notice_period_text is null and $6::text is not null then 'detected'::certainty else notice_period_certainty end,
         notice_period_text   = coalesce(notice_period_text, $6),
         required_form        = case when required_form is null or required_form = 'unknown' then coalesce($7, required_form) else required_form end,
         currency             = case when amount_minor is null and $8::bigint is not null then $9 else currency end,
         amount_minor         = coalesce(amount_minor, $8::bigint),
         billing_interval     = case when billing_interval is null or billing_interval = 'unknown' then coalesce($10, billing_interval) else billing_interval end,
         deposit_minor        = case when deposit_minor is null and (currency is null or currency = $9) then $11::bigint else deposit_minor end,
         source_document_id   = coalesce(source_document_id, $12)
       where id = $1`,
      [id, col.counterparty_name, col.counterparty_address, col.contract_number, col.start_date, col.notice_period_text,
       col.required_form, col.amount_minor, col.currency, col.billing_interval, col.deposit_minor, documentId]);
  } else {
    const r = await q<{ id: string }>(
      `insert into contracts (user_id, name, category, counterparty_name, counterparty_address, contract_number, start_date,
         notice_period_text, notice_period_certainty, required_form, amount_minor, currency, billing_interval, deposit_minor,
         certainty, source_document_id)
       values (auth.uid(), $1, $2, $3, $4, $5, $6::date, $7, $8::certainty, $9, $10::bigint, $11, $12, $13::bigint, 'detected', $14)
       returning id`,
      [col.name, col.category, col.counterparty_name, col.counterparty_address, col.contract_number, col.start_date,
       col.notice_period_text, col.notice_period_certainty, col.required_form, col.amount_minor, col.currency,
       col.billing_interval, col.deposit_minor, documentId]);
    id = r[0].id;
    created = true;
  }
  // Rückverweis am Dokument – so zeigt der Vertrag alle zugehörigen Unterlagen (Vertrag, Folgeseiten, Mietanpassung …)
  await q(`update documents set extracted = coalesce(extracted, '{}'::jsonb) || jsonb_build_object('contract_id', $2::text) where id = $1`, [documentId, id]);
  const name = (await q<{ name: string }>('select name from contracts where id = $1', [id]))[0]?.name ?? f.name;
  return { contractId: id, name, created };
}
