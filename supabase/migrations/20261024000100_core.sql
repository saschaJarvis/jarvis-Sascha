-- Jarvis Sascha – Migration 0001: Kern (P0)
-- Profile, Einwilligungen, Audit-Log (append-only, Hash-Kette), Hilfsfunktionen, MFA-Gate.
-- Annahmen: läuft in Supabase (auth.uid(), auth.jwt(), Rollen authenticated/service_role existieren).

-- Supabase legt Erweiterungen im Schema "extensions" ab; lokal genauso, damit Aufrufe identisch sind.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to authenticated, service_role;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Gemeinsame Typen
-- ---------------------------------------------------------------------------
-- Herkunft/Gewissheit jeder Angabe: erkannt (Parser), vermutet (KI/Heuristik), bestätigt (Nutzer/Dokument)
create type public.certainty as enum ('detected', 'inferred', 'verified');

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------
create or replace function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- MFA: Supabase setzt im JWT aal=aal2 nach erfolgreicher TOTP/Passkey-Prüfung.
create or replace function app.mfa_ok() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

-- Step-up: letzte MFA-Prüfung (amr-Eintrag totp/webauthn/mfa) nicht älter als p_max_age.
create or replace function app.step_up_recent(p_max_age interval default interval '10 minutes')
returns boolean
language sql stable as $$
  select app.mfa_ok() and exists (
    select 1
    from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as e
    where e ->> 'method' in ('totp', 'webauthn', 'mfa/totp', 'mfa/webauthn', 'mfa/phone')
      and to_timestamp((e ->> 'timestamp')::double precision) >= now() - p_max_age
  )
$$;

grant execute on function app.mfa_ok() to authenticated, service_role;
grant execute on function app.step_up_recent(interval) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Profile
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  locale text not null default 'de-DE',
  timezone text not null default 'Europe/Berlin',
  -- Ruhezeiten in lokaler Zeit des Nutzers
  quiet_hours_start time not null default '21:30',
  quiet_hours_end time not null default '08:00',
  max_notifications_per_day smallint not null default 4 check (max_notifications_per_day between 0 and 20),
  paused_until timestamptz,                      -- "Pause" für alle nicht-kritischen Erinnerungen
  moving_date date,                              -- geplanter Umzugstermin (vom Nutzer bestätigt)
  moving_date_certainty public.certainty,
  ui_mode text not null default 'guided' check (ui_mode in ('guided', 'overview', 'trusted_helper')),
  onboarding jsonb not null default '{}'::jsonb, -- Antworten des Wizards (keine Geheimnisse!)
  kill_switch boolean not null default false,    -- Notaus: stoppt alle automatischen Aktionen
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_tz_valid check (now() at time zone timezone is not null)
);
create trigger profiles_updated before update on public.profiles
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Einwilligungen (Consent-Ledger) – nur anhängen, Widerruf = neue Zeile
-- ---------------------------------------------------------------------------
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null,          -- z. B. 'notify.email', 'notify.sms', 'health.vault', 'helper.delegate', 'gmail.read'
  granted boolean not null,
  scope jsonb not null default '{}'::jsonb,
  text_version text not null,     -- welche Einwilligungstext-Version gezeigt wurde
  created_at timestamptz not null default now()
);
create index consent_records_user_purpose on public.consent_records (user_id, purpose, created_at desc);

create or replace function app.has_consent(p_user uuid, p_purpose text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select granted from public.consent_records
    where user_id = p_user and purpose = p_purpose
    order by created_at desc, id desc limit 1
  ), false)
$$;
revoke all on function app.has_consent(uuid, text) from public;
grant execute on function app.has_consent(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Audit-Log: append-only, pro Nutzer hash-verkettet, keine Inhalte/PII im Payload
-- ---------------------------------------------------------------------------
create table public.audit_events (
  seq bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  actor text not null,            -- 'user' | 'jarvis' | 'worker' | 'helper:<id>' | 'system'
  action text not null,           -- z. B. 'task.status', 'cancellation.approved'
  entity text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp(),
  prev_hash text not null,
  hash text not null unique
);
create index audit_events_user on public.audit_events (user_id, seq);

create or replace function app.audit_hash_input(
  p_user uuid, p_actor text, p_action text, p_entity text, p_entity_id uuid,
  p_payload jsonb, p_created timestamptz, p_prev text
) returns text language sql immutable as $$
  select concat_ws('|', p_prev, p_user::text, p_actor, p_action, p_entity,
                   coalesce(p_entity_id::text, '-'), p_payload::text,
                   to_char(p_created at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
$$;

create or replace function app.audit_chain() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_prev text;
begin
  -- Serialisieren pro Nutzer, damit die Kette nicht verzweigt
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 42));
  select hash into v_prev from public.audit_events
   where user_id = new.user_id order by seq desc limit 1;
  new.prev_hash := coalesce(v_prev, 'GENESIS');
  new.created_at := clock_timestamp();
  new.hash := encode(extensions.digest(app.audit_hash_input(new.user_id, new.actor, new.action, new.entity,
                       new.entity_id, new.payload, new.created_at, new.prev_hash), 'sha256'), 'hex');
  return new;
end $$;
create trigger audit_events_chain before insert on public.audit_events
  for each row execute function app.audit_chain();

create or replace function app.audit_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_events ist unveränderlich (append-only)' using errcode = 'insufficient_privilege';
end $$;
create trigger audit_events_no_update before update or delete on public.audit_events
  for each row execute function app.audit_immutable();

create or replace function app.log_audit(
  p_user uuid, p_actor text, p_action text, p_entity text, p_entity_id uuid, p_payload jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.audit_events (user_id, actor, action, entity, entity_id, payload, prev_hash, hash)
  values (p_user, p_actor, p_action, p_entity, p_entity_id, coalesce(p_payload, '{}'::jsonb), '', '');
end $$;
revoke all on function app.log_audit(uuid, text, text, text, uuid, jsonb) from public;
grant execute on function app.log_audit(uuid, text, text, text, uuid, jsonb) to service_role;

-- Prüft die Kette eines Nutzers; gibt die erste fehlerhafte seq zurück oder NULL
create or replace function app.verify_audit_chain(p_user uuid) returns bigint
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  r record;
  v_prev text := 'GENESIS';
begin
  -- Angemeldete Nutzer dürfen nur ihre eigene Kette prüfen; Worker (ohne sub) alle
  if auth.uid() is not null and auth.uid() <> p_user then
    raise exception 'nicht erlaubt' using errcode = 'insufficient_privilege';
  end if;
  for r in select * from public.audit_events where user_id = p_user order by seq loop
    if r.prev_hash <> v_prev or r.hash <> encode(extensions.digest(app.audit_hash_input(r.user_id, r.actor, r.action,
        r.entity, r.entity_id, r.payload, r.created_at, r.prev_hash), 'sha256'), 'hex') then
      return r.seq;
    end if;
    v_prev := r.hash;
  end loop;
  return null;
end $$;
revoke all on function app.verify_audit_chain(uuid) from public;
grant execute on function app.verify_audit_chain(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.consent_records enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_own on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy consent_own_read on public.consent_records for select to authenticated
  using (user_id = auth.uid());
create policy consent_own_insert on public.consent_records for insert to authenticated
  with check (user_id = auth.uid());
create policy audit_own_read on public.audit_events for select to authenticated
  using (user_id = auth.uid());

-- MFA-Pflicht: restriktive Policy, gilt zusätzlich zu allen anderen
create policy profiles_mfa on public.profiles as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
create policy consent_mfa on public.consent_records as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
create policy audit_mfa on public.audit_events as restrictive for select to authenticated
  using (app.mfa_ok());

revoke all on public.profiles, public.consent_records, public.audit_events from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert on public.consent_records to authenticated;
grant select on public.audit_events to authenticated;
grant all on public.profiles, public.consent_records, public.audit_events to service_role;
grant usage on sequence public.audit_events_seq_seq to service_role;
