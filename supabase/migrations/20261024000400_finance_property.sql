-- Jarvis Sascha – Migration 0004: Finanzen & Immobilie (Grundgerüst für P2/P5)
-- Beträge immer als ganze Kleinsteinheiten (Cent/Fils) in bigint. Keine Bank-Zugangsdaten, keine Seeds/Private Keys.

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,                        -- z. B. 'Sparkasse Giro' – keine IBAN nötig
  institution text,
  kind text not null check (kind in ('checking', 'savings', 'credit_card', 'deposit', 'crypto_exchange', 'crypto_wallet', 'loan', 'other')),
  currency char(3) not null,
  iban_last4 text check (iban_last4 ~ '^[0-9A-Z]{4}$'),
  public_wallet_address text,                -- optional, nur öffentlich, nur lesend
  is_business boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint no_secret_material check (
    public_wallet_address is null or (
      public_wallet_address !~* '(xprv|yprv|zprv|tprv)' and
      array_length(regexp_split_to_array(trim(public_wallet_address), '\s+'), 1) = 1))
);

create table public.imported_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id),
  adapter text not null,                     -- z. B. 'generic_csv_de', 'kraken_ledger_csv'
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  rows_total integer not null default 0,
  rows_imported integer not null default 0,
  rows_duplicate integer not null default 0,
  rows_unknown integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, sha256)                   -- dieselbe Datei nicht zweimal importieren
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  imported_file_id uuid references public.imported_files (id),
  source_row integer,                        -- Provenienz: Zeile in der Importdatei
  booking_date date not null,
  value_date date,
  amount_minor bigint not null,              -- negativ = Abgang
  currency char(3) not null,
  counterparty text,
  purpose text,
  external_id text,
  dedup_key text not null,                   -- deterministisch, s. src/lib/domain/transactions.ts
  duplicate_of uuid references public.transactions (id),
  transfer_pair_id uuid references public.transactions (id),
  category text,
  category_certainty public.certainty,
  manual_override jsonb,
  created_at timestamptz not null default now()
);
create index transactions_user_date on public.transactions (user_id, booking_date);
create index transactions_dedup on public.transactions (user_id, dedup_key);

create table public.fx_rates (
  base char(3) not null,
  quote char(3) not null,
  as_of date not null,
  rate numeric(24, 12) not null check (rate > 0),
  source text not null,                      -- z. B. 'EZB Referenzkurs'
  fetched_at timestamptz not null default now(),
  primary key (base, quote, as_of, source)
);

create table public.balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete cascade,
  as_of date not null,
  amount_minor bigint not null,
  currency char(3) not null,
  asset_symbol text,                         -- für Krypto: 'BTC' etc.; amount dann in kleinster Einheit
  source text not null check (source in ('import', 'manual', 'statement')),
  certainty public.certainty not null default 'detected',
  created_at timestamptz not null default now()
);

create table public.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('mortgage', 'credit_card', 'tax', 'loan', 'other')),
  name text not null,
  outstanding_minor bigint check (outstanding_minor >= 0),
  currency char(3),
  certainty public.certainty not null default 'detected',
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Immobilie: alle Angaben bis zum Dokumentbeleg als 'inferred'/'detected' markiert
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_name text not null,
  developer text,
  location text,
  unit_no text,
  size_sqft numeric(10, 2),
  size_certainty public.certainty,
  view_text text,
  view_certainty public.certainty,
  purchase_price_minor bigint,
  purchase_currency char(3),
  price_certainty public.certainty,
  financing_ltv_pct numeric(5, 2),
  financing_certainty public.certainty,
  expected_completion text,
  completion_certainty public.certainty,
  photo_document_id uuid references public.documents (id),  -- nur rechtlich freigegebene, echte Fotos
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.mortgages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid references public.properties (id) on delete cascade,
  lender text,
  principal_minor bigint check (principal_minor > 0),
  currency char(3),
  annual_rate_bps integer check (annual_rate_bps between 0 and 5000),  -- nur aus Bankangebot
  term_months integer check (term_months between 1 and 600),
  first_payment_on date,
  certainty public.certainty not null default 'detected',
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['accounts', 'imported_files', 'transactions', 'balances', 'liabilities', 'properties', 'mortgages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_update', t);
    execute format('create policy %I on public.%I as restrictive for all to authenticated using (app.mfa_ok()) with check (app.mfa_ok())', t || '_mfa', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Wechselkurse sind öffentlich-nicht-personenbezogen: lesen für alle Angemeldeten, schreiben nur Worker
alter table public.fx_rates enable row level security;
create policy fx_read on public.fx_rates for select to authenticated using (true);
revoke all on public.fx_rates from anon, authenticated;
grant select on public.fx_rates to authenticated;
grant all on public.fx_rates to service_role;
