-- Litecoin-Wallets (LTC) NUR ZUM ANSEHEN (eigene Tabelle, rein additiv). Nur öffentliche Adresse L…/M… (Base58) oder ltc1… (Bech32).
create table public.ltc_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  address text not null check (address ~ '^([LM][1-9A-HJ-NP-Za-km-z]{26,33}|ltc1[02-9ac-hj-np-z]{20,80})$'),
  label text not null default 'Ledger LTC' check (length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index ltc_wallets_unique on public.ltc_wallets (user_id, address) where deleted_at is null;
create trigger ltc_wallets_updated before update on public.ltc_wallets
  for each row execute function app.set_updated_at();

alter table public.ltc_wallets enable row level security;
create policy ltc_wallets_own on public.ltc_wallets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ltc_wallets_mfa on public.ltc_wallets as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
revoke all on public.ltc_wallets from anon, authenticated;
grant select, insert, update on public.ltc_wallets to authenticated;
grant all on public.ltc_wallets to service_role;

create or replace function app.ltc_wallets_limit() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (select count(*) from public.ltc_wallets where user_id = new.user_id and deleted_at is null) >= 20 then
    raise exception 'Höchstens 20 Wallets – bitte erst eines entfernen.';
  end if;
  return new;
end $$;
create trigger ltc_wallets_limit before insert on public.ltc_wallets
  for each row execute function app.ltc_wallets_limit();

create or replace function app.audit_ltc_wallet() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.log_audit(new.user_id, 'user',
    case when tg_op = 'INSERT' then 'wallet.added' when new.deleted_at is not null then 'wallet.removed' else 'wallet.updated' end,
    'ltc_wallet', new.id, jsonb_build_object('chain', 'ltc', 'label', new.label));
  return new;
end $$;
create trigger ltc_wallets_audit after insert or update on public.ltc_wallets
  for each row execute function app.audit_ltc_wallet();
