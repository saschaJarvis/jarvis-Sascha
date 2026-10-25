-- Krypto-Wallets NUR ZUM ANSEHEN: gespeichert wird ausschließlich die öffentliche Adresse.
-- Keine Spalten für Schlüssel, Seeds oder PINs – absichtlich. Adressen sind öffentlich, aber privat
-- in dem Sinn, dass sie dein Vermögen verraten → nur der Besitzer sieht sie, MFA-Pflicht.
create table public.crypto_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chain text not null check (chain in ('xrp')),
  address text not null check (address ~ '^r[1-9A-HJ-NP-Za-km-z]{24,34}$'),
  label text not null default 'Ledger' check (length(label) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index crypto_wallets_unique on public.crypto_wallets (user_id, chain, address) where deleted_at is null;
create trigger crypto_wallets_updated before update on public.crypto_wallets
  for each row execute function app.set_updated_at();

alter table public.crypto_wallets enable row level security;
create policy crypto_wallets_own on public.crypto_wallets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy crypto_wallets_mfa on public.crypto_wallets as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
revoke all on public.crypto_wallets from anon, authenticated;
grant select, insert, update on public.crypto_wallets to authenticated;
grant all on public.crypto_wallets to service_role;

create or replace function app.crypto_wallets_limit() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (select count(*) from public.crypto_wallets where user_id = new.user_id and deleted_at is null) >= 20 then
    raise exception 'Höchstens 20 Wallets – bitte erst eines entfernen.';
  end if;
  return new;
end $$;
create trigger crypto_wallets_limit before insert on public.crypto_wallets
  for each row execute function app.crypto_wallets_limit();

-- Audit ohne Adresse (nur Kette + Bezeichnung)
create or replace function app.audit_crypto_wallet() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.log_audit(new.user_id, 'user',
    case when tg_op = 'INSERT' then 'wallet.added' when new.deleted_at is not null then 'wallet.removed' else 'wallet.updated' end,
    'crypto_wallet', new.id, jsonb_build_object('chain', new.chain, 'label', new.label));
  return new;
end $$;
create trigger crypto_wallets_audit after insert or update on public.crypto_wallets
  for each row execute function app.audit_crypto_wallet();
