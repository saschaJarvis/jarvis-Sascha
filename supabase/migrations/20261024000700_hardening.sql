-- Jarvis Sascha – Migration 0007: Härtung nach Supabase-Advisor
-- 1) Fester search_path für alle Hilfsfunktionen (Schutz gegen Schema-Unterschiebung)
-- 2) RLS-Policies: auth.uid()/app.mfa_ok() einmal pro Abfrage statt pro Zeile auswerten (initplan)

alter function app.set_updated_at() set search_path = pg_catalog, pg_temp;
alter function app.mfa_ok() set search_path = pg_catalog, pg_temp;
alter function app.step_up_recent(interval) set search_path = pg_catalog, pg_temp;
alter function app.audit_hash_input(uuid, text, text, text, uuid, jsonb, timestamptz, text) set search_path = pg_catalog, pg_temp;
alter function app.audit_immutable() set search_path = pg_catalog, pg_temp;
alter function app.approvals_immutable() set search_path = pg_catalog, pg_temp;

do $$
declare
  p record;
  q text;
  c text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') ~ '(auth\.uid\(\)|app\.mfa_ok\(\))' or coalesce(with_check, '') ~ '(auth\.uid\(\)|app\.mfa_ok\(\))')
  loop
    q := p.qual; c := p.with_check;
    if q is not null and q !~ 'SELECT auth\.uid|SELECT app\.mfa_ok' then
      q := replace(replace(q, 'auth.uid()', '(select auth.uid())'), 'app.mfa_ok()', '(select app.mfa_ok())');
    end if;
    if c is not null and c !~ 'SELECT auth\.uid|SELECT app\.mfa_ok' then
      c := replace(replace(c, 'auth.uid()', '(select auth.uid())'), 'app.mfa_ok()', '(select app.mfa_ok())');
    end if;
    if q is not null and c is not null then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', p.policyname, p.schemaname, p.tablename, q, c);
    elsif q is not null then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, q);
    else
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, c);
    end if;
  end loop;
end $$;

-- Indizes für Fremdschlüssel auf user_id (schnelleres Löschen/Export)
create index if not exists accounts_user on public.accounts (user_id);
create index if not exists approvals_user on public.approvals (user_id);
create index if not exists balances_user on public.balances (user_id);
create index if not exists liabilities_user on public.liabilities (user_id);
create index if not exists properties_user on public.properties (user_id);
create index if not exists mortgages_user on public.mortgages (user_id);
create index if not exists task_evidence_user on public.task_evidence (user_id);
create index if not exists upload_requests_user on public.upload_requests (user_id);
create index if not exists deletion_requests_user on public.deletion_requests (user_id);
create index if not exists reminders_task on public.reminders (task_id);
create index if not exists transactions_account on public.transactions (account_id);
