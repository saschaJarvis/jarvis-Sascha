-- Edelmetall-Rechnungen: Belege liegen in der Ablage (Ordner „metals“), Claude liest Positionen aus
-- (Metall, Produkt, Stück, Gewicht, Feingehalt, Preis) → je Position ein Bestand in gold_holdings mit Kaufdaten.
alter table public.documents drop constraint documents_folder_check;
alter table public.documents add constraint documents_folder_check check (folder in (
  'identity', 'housing', 'office', 'storage', 'business', 'taxes', 'banks', 'crypto', 'insurance',
  'subscriptions', 'shipping', 'customs', 'visa', 'uae_property', 'utilities', 'healthcare', 'vehicles',
  'travel', 'legal', 'metals', 'other'));

alter table public.gold_holdings
  add column pieces integer check (pieces is null or pieces between 1 and 100000),
  add column purchase_total numeric(14, 2) check (purchase_total is null or purchase_total >= 0),
  add column purchase_currency char(3),
  add column purchased_on date,
  add column dealer text check (dealer is null or length(dealer) <= 80),
  add column invoice_no text check (invoice_no is null or length(invoice_no) <= 40),
  add column document_id uuid references public.documents (id) on delete set null;
create index gold_holdings_invoice on public.gold_holdings (user_id, invoice_no) where deleted_at is null and invoice_no is not null;

create table public.metal_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  attempts smallint not null default 0,
  error text,
  started_at timestamptz,
  dealer text,
  invoice_no text,
  invoice_date date,
  currency char(3),
  total numeric(14, 2),
  positions integer,
  analysis jsonb not null default '{}'::jsonb,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);
create index metal_invoices_user on public.metal_invoices (user_id, invoice_date desc);
create trigger metal_invoices_updated before update on public.metal_invoices for each row execute function app.set_updated_at();
alter table public.metal_invoices enable row level security;
create policy metal_invoices_own on public.metal_invoices for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy metal_invoices_mfa on public.metal_invoices as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
revoke all on public.metal_invoices from anon, authenticated;
grant select, insert, update on public.metal_invoices to authenticated;
grant all on public.metal_invoices to service_role;
