-- Kontoauszug-Auswertung: ein Eintrag je hochgeladenem Kontoauszug (PDF aus der Ablage, Ordner „banks“).
-- Claude liest den Auszug und liefert Salden, Summen, Kategorien, größte Posten und Daueraufträge.
-- Der Endsaldo wird als Kontostand (balances, source 'statement') übernommen → Gesamtvermögen aktualisiert sich.
create table public.bank_statements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  balance_id uuid references public.balances (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'error')),
  attempts smallint not null default 0,
  error text,
  started_at timestamptz,
  bank text,
  currency char(3),
  statement_no text,
  period_from date,
  period_to date,
  opening_minor bigint,
  closing_minor bigint,
  in_minor bigint,
  out_minor bigint,
  analysis jsonb not null default '{}'::jsonb,   -- Kategorien, größte Posten, Daueraufträge, Hinweise
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id)
);
create index bank_statements_user on public.bank_statements (user_id, period_to desc);
create trigger bank_statements_updated before update on public.bank_statements
  for each row execute function app.set_updated_at();

alter table public.bank_statements enable row level security;
create policy bank_statements_own on public.bank_statements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy bank_statements_mfa on public.bank_statements as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
revoke all on public.bank_statements from anon, authenticated;
grant select, insert, update on public.bank_statements to authenticated;
grant all on public.bank_statements to service_role;
