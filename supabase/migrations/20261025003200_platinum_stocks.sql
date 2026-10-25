-- Platin (gleiche Tabelle wie Gold, Spalte metal) und Aktien/ETFs (Stückzahl, Kurs über Yahoo Finance).
alter table public.gold_holdings add column metal text not null default 'gold' check (metal in ('gold', 'platinum'));

create table public.stock_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Za-z0-9.^=-]{1,20}$'),   -- Yahoo-Kürzel, z. B. AAPL, SAP.DE, VWRA.L
  name text check (name is null or length(name) <= 120),
  isin text check (isin is null or isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  currency text,
  quantity numeric(24, 8) not null check (quantity >= 0),
  label text not null check (length(label) between 1 and 60),
  venue text check (venue is null or length(venue) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index stock_holdings_user on public.stock_holdings (user_id) where deleted_at is null;
create trigger stock_holdings_updated before update on public.stock_holdings for each row execute function app.set_updated_at();
alter table public.stock_holdings enable row level security;
create policy stock_holdings_own on public.stock_holdings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy stock_holdings_mfa on public.stock_holdings as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
revoke all on public.stock_holdings from anon, authenticated;
grant select, insert, update on public.stock_holdings to authenticated;
grant all on public.stock_holdings to service_role;

-- Eigene Schwelle für die Tagesbewegung von Aktien + Edelmetallen (ruhiger als Krypto)
alter table public.alert_settings add column other_threshold_pct numeric(5, 2) not null default 5 check (other_threshold_pct between 1 and 90);
