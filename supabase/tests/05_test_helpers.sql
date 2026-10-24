-- Test-Helfer (nur lokal)
create schema if not exists test;
grant usage on schema test to authenticated, anon, service_role;

create table if not exists test.results (id serial primary key, name text not null, ok boolean not null, detail text);
grant all on test.results to authenticated, anon, service_role;
grant usage on sequence test.results_id_seq to authenticated, anon, service_role;

-- Als Nutzer anmelden (simuliert Supabase-JWT). aal: 'aal1' | 'aal2'; mfa_age_seconds: Alter der letzten MFA
create or replace function test.login(p_uid uuid, p_aal text default 'aal2', p_mfa_age_seconds int default 30)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_uid, 'role', 'authenticated', 'aal', p_aal,
    'amr', case when p_aal = 'aal2' then jsonb_build_array(
        jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now()) - 3600),
        jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now()) - p_mfa_age_seconds))
      else jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now()) - 60)) end
  )::text, false);
end $$;
grant execute on function test.login(uuid, text, int) to authenticated, anon, service_role;

create or replace function test.ok(p_name text, p_cond boolean, p_detail text default null) returns void
language plpgsql as $$
begin
  insert into test.results (name, ok, detail) values (p_name, coalesce(p_cond, false), p_detail);
end $$;
grant execute on function test.ok(text, boolean, text) to authenticated, anon, service_role;

-- Erwartet, dass p_sql einen Fehler wirft, dessen Text p_pattern (ILIKE) enthält
create or replace function test.throws(p_name text, p_sql text, p_pattern text default '%') returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
    insert into test.results (name, ok, detail) values (p_name, false, 'kein Fehler geworfen');
  exception when others then
    insert into test.results (name, ok, detail) values (p_name, sqlerrm ilike p_pattern, sqlerrm);
  end;
end $$;
grant execute on function test.throws(text, text, text) to authenticated, anon, service_role;

-- Erwartet, dass p_sql KEINEN Fehler wirft
create or replace function test.lives(p_name text, p_sql text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
    insert into test.results (name, ok, detail) values (p_name, true, null);
  exception when others then
    insert into test.results (name, ok, detail) values (p_name, false, sqlerrm);
  end;
end $$;
grant execute on function test.lives(text, text) to authenticated, anon, service_role;
