-- Krypto auf Börsen/Plattformen ohne Abruf (z. B. Bitpanda): Menge von Hand, bewertet zum aktuellen Kurs.
-- Zählt ins Vermögen und in die Kurswarnung; Abfluss-/Eingangswarnungen gibt es dafür nicht (kein Einblick).
create table public.manual_crypto (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9]{2,10}$'),
  amount numeric(30, 10) not null check (amount >= 0),
  label text not null check (length(label) between 1 and 40),
  venue text check (venue is null or length(venue) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index manual_crypto_user on public.manual_crypto (user_id) where deleted_at is null;
create trigger manual_crypto_updated before update on public.manual_crypto for each row execute function app.set_updated_at();
alter table public.manual_crypto enable row level security;
create policy manual_crypto_own on public.manual_crypto for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy manual_crypto_mfa on public.manual_crypto as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
revoke all on public.manual_crypto from anon, authenticated;
grant select, insert, update on public.manual_crypto to authenticated;
grant all on public.manual_crypto to service_role;
