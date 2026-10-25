-- Gold-Bestand (Barren, Münzen, Schmuck). Bewertet mit dem aktuellen Goldpreis × Feingehalt.
create table public.gold_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (length(label) between 1 and 60),
  grams numeric(12, 3) not null check (grams > 0 and grams <= 1000000),
  purity smallint not null default 999 check (purity between 100 and 1000),  -- Tausendstel: 999,9=999, 22K=916, 18K=750
  form text not null default 'bar' check (form in ('bar', 'coin', 'jewelry', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index gold_holdings_user on public.gold_holdings (user_id) where deleted_at is null;
create trigger gold_holdings_updated before update on public.gold_holdings
  for each row execute function app.set_updated_at();

alter table public.gold_holdings enable row level security;
create policy gold_holdings_own on public.gold_holdings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy gold_holdings_mfa on public.gold_holdings as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
revoke all on public.gold_holdings from anon, authenticated;
grant select, insert, update on public.gold_holdings to authenticated;
grant all on public.gold_holdings to service_role;

-- Konten: Soft-Delete für manuell gepflegte Konten erlauben bleibt über deleted_at (Spalte existiert).
-- Audit für Gold und Kontostände (ohne Beträge im Klartext → nur Ereignis)
create or replace function app.audit_gold() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.log_audit(new.user_id, 'user',
    case when tg_op = 'INSERT' then 'gold.added' when new.deleted_at is not null then 'gold.removed' else 'gold.updated' end,
    'gold_holding', new.id, jsonb_build_object('label', new.label));
  return new;
end $$;
create trigger gold_holdings_audit after insert or update on public.gold_holdings
  for each row execute function app.audit_gold();
