-- Wiederkehrende Zahlungen (z. B. Lagermiete): Jarvis legt daraus je Monat eine abhakbare Aufgabe an.
-- day_of_month: 1–28 fester Tag, -1 = letzter Tag des Monats.
create table public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contract_id uuid references public.contracts (id) on delete set null,
  title text not null check (length(title) between 1 and 120),
  amount_minor bigint check (amount_minor > 0),
  currency char(3),
  day_of_month smallint not null check (day_of_month = -1 or day_of_month between 1 and 28),
  remind_hour smallint not null default 9 check (remind_hour between 0 and 23),
  payee_match text check (length(payee_match) <= 60),   -- für späteren Abgleich mit Kontoauszügen
  note text check (length(note) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint recurring_bills_currency check ((amount_minor is null) = (currency is null))
);
create index recurring_bills_user on public.recurring_bills (user_id) where deleted_at is null;
create trigger recurring_bills_updated before update on public.recurring_bills
  for each row execute function app.set_updated_at();

alter table public.recurring_bills enable row level security;
create policy recurring_bills_own on public.recurring_bills for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy recurring_bills_mfa on public.recurring_bills as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
revoke all on public.recurring_bills from anon, authenticated;
grant select, insert, update on public.recurring_bills to authenticated;
grant all on public.recurring_bills to service_role;

create or replace function app.audit_recurring_bill() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.log_audit(new.user_id, 'user',
    case when tg_op = 'INSERT' then 'bill.created' when new.deleted_at is not null then 'bill.removed' else 'bill.updated' end,
    'recurring_bill', new.id, jsonb_build_object('title', new.title, 'day', new.day_of_month));
  return new;
end $$;
create trigger recurring_bills_audit after insert or update on public.recurring_bills
  for each row execute function app.audit_recurring_bill();
