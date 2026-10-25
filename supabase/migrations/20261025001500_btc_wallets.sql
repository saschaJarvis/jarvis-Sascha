-- Bitcoin-Wallets NUR ZUM ANSEHEN (eigene Tabelle, rein additiv). Nur öffentliche Adresse (1…, 3…, bc1…).
create table public.btc_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  address text not null check (address ~ '^([13][1-9A-HJ-NP-Za-km-z]{25,34}|(bc1|BC1)[02-9ac-hj-np-zAC-HJ-NP-Z]{11,71})$'),
  label text not null default 'Ledger BTC' check (length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index btc_wallets_unique on public.btc_wallets (user_id, lower(address)) where deleted_at is null;
create trigger btc_wallets_updated before update on public.btc_wallets
  for each row execute function app.set_updated_at();

alter table public.btc_wallets enable row level security;
create policy btc_wallets_own on public.btc_wallets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy btc_wallets_mfa on public.btc_wallets as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
revoke all on public.btc_wallets from anon, authenticated;
grant select, insert, update on public.btc_wallets to authenticated;
grant all on public.btc_wallets to service_role;

create or replace function app.btc_wallets_limit() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (select count(*) from public.btc_wallets where user_id = new.user_id and deleted_at is null) >= 20 then
    raise exception 'Höchstens 20 Wallets – bitte erst eines entfernen.';
  end if;
  return new;
end $$;
create trigger btc_wallets_limit before insert on public.btc_wallets
  for each row execute function app.btc_wallets_limit();

create or replace function app.audit_btc_wallet() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.log_audit(new.user_id, 'user',
    case when tg_op = 'INSERT' then 'wallet.added' when new.deleted_at is not null then 'wallet.removed' else 'wallet.updated' end,
    'btc_wallet', new.id, jsonb_build_object('chain', 'btc', 'label', new.label));
  return new;
end $$;
create trigger btc_wallets_audit after insert or update on public.btc_wallets
  for each row execute function app.audit_btc_wallet();
