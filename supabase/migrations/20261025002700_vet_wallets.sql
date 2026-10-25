-- VeChain-Wallets (VET) NUR ZUM ANSEHEN (eigene Tabelle, rein additiv). Nur öffentliche Adresse 0x… (40 Hex-Zeichen).
create table public.vet_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  address text not null check (address ~ '^0x[0-9a-fA-F]{40}$'),
  label text not null default 'Ledger VET' check (length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index vet_wallets_unique on public.vet_wallets (user_id, lower(address)) where deleted_at is null;
create trigger vet_wallets_updated before update on public.vet_wallets
  for each row execute function app.set_updated_at();

alter table public.vet_wallets enable row level security;
create policy vet_wallets_own on public.vet_wallets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy vet_wallets_mfa on public.vet_wallets as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
revoke all on public.vet_wallets from anon, authenticated;
grant select, insert, update on public.vet_wallets to authenticated;
grant all on public.vet_wallets to service_role;

create or replace function app.vet_wallets_limit() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (select count(*) from public.vet_wallets where user_id = new.user_id and deleted_at is null) >= 20 then
    raise exception 'Höchstens 20 Wallets – bitte erst eines entfernen.';
  end if;
  return new;
end $$;
create trigger vet_wallets_limit before insert on public.vet_wallets
  for each row execute function app.vet_wallets_limit();

create or replace function app.audit_vet_wallet() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.log_audit(new.user_id, 'user',
    case when tg_op = 'INSERT' then 'wallet.added' when new.deleted_at is not null then 'wallet.removed' else 'wallet.updated' end,
    'vet_wallet', new.id, jsonb_build_object('chain', 'vet', 'label', new.label));
  return new;
end $$;
create trigger vet_wallets_audit after insert or update on public.vet_wallets
  for each row execute function app.audit_vet_wallet();
