-- Jarvis Sascha – Migration 0005: Datenexport (DSGVO Art. 15/20), Löschanfrage, Storage-Policies

-- Export aller eigenen Daten als JSON (Dateien selbst werden serverseitig als signierte URLs ergänzt)
create or replace function app.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v jsonb := '{}'::jsonb;
  t text;
  rows jsonb;
begin
  if v_uid is null or not app.step_up_recent(interval '10 minutes') then
    raise exception 'Export erfordert frisches Step-up' using errcode = 'insufficient_privilege';
  end if;
  foreach t in array array['tasks', 'task_dependencies', 'task_evidence', 'documents', 'document_versions',
    'contracts', 'cancellation_requests', 'approvals', 'outbound_messages', 'reminders', 'notification_attempts',
    'accounts', 'imported_files', 'transactions', 'balances', 'liabilities', 'properties', 'mortgages',
    'consent_records', 'audit_events'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.user_id = $1', t)
      into rows using v_uid;
    v := v || jsonb_build_object(t, rows);
  end loop;
  v := v || jsonb_build_object('profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
                               'exported_at', now());
  return v;
end $$;
revoke all on function app.export_my_data() from public;
grant execute on function app.export_my_data() to authenticated;

-- Löschanfrage: markiert Konto; ein Worker löscht nach Karenzzeit (Storage zuerst, dann auth.users -> cascade)
create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now(),
  execute_after timestamptz not null default now() + interval '7 days',
  cancelled_at timestamptz,
  executed_at timestamptz
);
alter table public.deletion_requests enable row level security;
create policy deletion_read on public.deletion_requests for select to authenticated using (user_id = auth.uid());
revoke all on public.deletion_requests from anon, authenticated;
grant select on public.deletion_requests to authenticated;
grant all on public.deletion_requests to service_role;

create or replace function app.request_account_deletion() returns uuid
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare v_id uuid;
begin
  if not app.step_up_recent(interval '10 minutes') then
    raise exception 'Löschung erfordert frisches Step-up' using errcode = 'insufficient_privilege';
  end if;
  insert into public.deletion_requests (user_id) values (auth.uid()) returning id into v_id;
  update public.profiles set kill_switch = true where id = auth.uid();
  perform app.log_audit(auth.uid(), 'user', 'account.deletion_requested', 'deletion_request', v_id, '{}'::jsonb);
  return v_id;
end $$;
revoke all on function app.request_account_deletion() from public;
grant execute on function app.request_account_deletion() to authenticated;

-- Supabase Storage: privater Bucket 'vault', Pfade beginnen mit <user_id>/
-- Nur ausführen, wenn das Storage-Schema existiert (in echtem Supabase ja, im lokalen Test-Postgres nein).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('vault', 'vault', false, 52428800)
    on conflict (id) do update set public = false;

    execute $p$create policy vault_read on storage.objects for select to authenticated
      using (bucket_id = 'vault' and (storage.foldername(name))[1] = auth.uid()::text and app.mfa_ok())$p$;
    execute $p$create policy vault_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'vault' and (storage.foldername(name))[1] = auth.uid()::text and app.mfa_ok())$p$;
    -- kein Update/Delete durch Nutzer: Versionen sind unveränderlich, Löschen läuft über den Lösch-Worker
  end if;
end $$;
