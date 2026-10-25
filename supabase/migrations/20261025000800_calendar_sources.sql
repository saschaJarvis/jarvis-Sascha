-- Externe Kalender (nur lesend): veröffentlichte iCal-Links (iPhone/iCloud, Google, Outlook).
-- Der Link ist ein Geheimnis (wer ihn kennt, sieht den Kalender) → nur der Besitzer liest ihn, MFA-Pflicht.
create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  kind text not null default 'ics' check (kind in ('ics')),
  provider text not null check (provider in ('icloud', 'google', 'outlook')),
  url text not null check (url ~ '^https://[^/\s]+/\S+$' and length(url) <= 2000),
  color text not null default 'sea' check (color in ('sea', 'warn', 'good', 'bad', 'muted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index calendar_sources_user on public.calendar_sources (user_id) where deleted_at is null;
create unique index calendar_sources_unique_url on public.calendar_sources (user_id, url) where deleted_at is null;
create trigger calendar_sources_updated before update on public.calendar_sources
  for each row execute function app.set_updated_at();

alter table public.calendar_sources enable row level security;
create policy calendar_sources_own on public.calendar_sources for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy calendar_sources_mfa on public.calendar_sources as restrictive for all to authenticated
  using (app.mfa_ok()) with check (app.mfa_ok());
revoke all on public.calendar_sources from anon, authenticated;
grant select, insert, update on public.calendar_sources to authenticated;
grant all on public.calendar_sources to service_role;

-- Höchstens 10 Kalender pro Nutzer
create or replace function app.calendar_sources_limit() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (select count(*) from public.calendar_sources where user_id = new.user_id and deleted_at is null) >= 10 then
    raise exception 'Höchstens 10 Kalender – bitte erst einen entfernen.';
  end if;
  return new;
end $$;
create trigger calendar_sources_limit before insert on public.calendar_sources
  for each row execute function app.calendar_sources_limit();

-- Audit (ohne URL – die ist geheim)
create or replace function app.audit_calendar_source() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform app.log_audit(new.user_id, 'user',
    case when tg_op = 'INSERT' then 'calendar.connected' when new.deleted_at is not null then 'calendar.removed' else 'calendar.updated' end,
    'calendar_source', new.id, jsonb_build_object('provider', new.provider, 'name', new.name));
  return new;
end $$;
create trigger calendar_sources_audit after insert or update on public.calendar_sources
  for each row execute function app.audit_calendar_source();
