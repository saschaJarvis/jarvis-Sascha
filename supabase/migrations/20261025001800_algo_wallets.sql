-- Algorand-Wallets NUR ZUM ANSEHEN (eigene Tabelle, rein additiv). Nur öffentliche Adresse (58 Zeichen Base32).
create table public.algo_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  address text not null check (address ~ '^[A-Z2-7]{58}$'),
  label text not null default 'Ledger ALGO' check (length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index algo_wallets_unique on public.algo_wallets (user_id, lower(address)) where deleted_at is null;
create trigger algo_wallets_updated before update on public.algo_wallets
  for each row execute function app.set_updated_at();

alter table public.algo_wallets enable row level security;
create policy algo_wallets_own on public.algo_wallets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy algo_wallets_mfa on public.algo_wallets as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
revoke all on public.algo_wallets from anon, authenticated;
grant select, insert, update on public.algo_wallets to authenticated;
grant all on public.algo_wallets to service_role;

create or replace function app.algo_wallets_limit() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (select count(*) from public.algo_wallets where user_id = new.user_id and deleted_at is null) >= 20 then
    raise exception 'Höchstens 20 Wallets – bitte erst eines entfernen.';
  end if;
  return new;
end $$;
create trigger algo_wallets_limit before insert on public.algo_wallets
  for each row execute function app.algo_wallets_limit();

create or replace function app.audit_algo_wallet() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.log_audit(new.user_id, 'user',
    case when tg_op = 'INSERT' then 'wallet.added' when new.deleted_at is not null then 'wallet.removed' else 'wallet.updated' end,
    'algo_wallet', new.id, jsonb_build_object('chain', 'algo', 'label', new.label));
  return new;
end $$;
create trigger algo_wallets_audit after insert or update on public.algo_wallets
  for each row execute function app.audit_algo_wallet();
