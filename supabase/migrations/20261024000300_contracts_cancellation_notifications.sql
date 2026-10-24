-- Jarvis Sascha – Migration 0003: Verträge, Kündigungs-Pipeline, Freigaben, Ausgangsnachrichten, Erinnerungen

create type public.cancellation_status as enum (
  'DETECTED', 'TERMS_REVIEW', 'DRAFT', 'USER_REVIEW', 'APPROVED', 'SENT',
  'DELIVERY_EVIDENCE', 'CONFIRMED', 'CLOSED', 'BLOCKED', 'ERROR', 'DISPUTED'
);

create table app.cancellation_transitions (
  from_status public.cancellation_status not null,
  to_status public.cancellation_status not null,
  primary key (from_status, to_status)
);
insert into app.cancellation_transitions values
  ('DETECTED', 'TERMS_REVIEW'), ('DETECTED', 'BLOCKED'),
  ('TERMS_REVIEW', 'DRAFT'), ('TERMS_REVIEW', 'BLOCKED'),
  ('DRAFT', 'USER_REVIEW'), ('DRAFT', 'TERMS_REVIEW'), ('DRAFT', 'BLOCKED'),
  ('USER_REVIEW', 'APPROVED'), ('USER_REVIEW', 'DRAFT'),
  ('APPROVED', 'SENT'), ('APPROVED', 'DRAFT'), ('APPROVED', 'ERROR'),
  ('SENT', 'DELIVERY_EVIDENCE'), ('SENT', 'ERROR'), ('SENT', 'DISPUTED'),
  ('DELIVERY_EVIDENCE', 'CONFIRMED'), ('DELIVERY_EVIDENCE', 'DISPUTED'),
  ('CONFIRMED', 'CLOSED'), ('CONFIRMED', 'DISPUTED'),
  ('BLOCKED', 'TERMS_REVIEW'), ('BLOCKED', 'DRAFT'),
  ('ERROR', 'DRAFT'), ('ERROR', 'USER_REVIEW'),
  ('DISPUTED', 'DRAFT'), ('DISPUTED', 'DELIVERY_EVIDENCE'), ('DISPUTED', 'CONFIRMED');
grant select on app.cancellation_transitions to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Verträge / Abos
-- Unbekannte Werte bleiben NULL – niemals raten.
-- ---------------------------------------------------------------------------
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null check (category in (
    'residential_lease', 'commercial_lease', 'storage', 'telecom', 'energy', 'insurance',
    'subscription', 'banking', 'membership', 'vehicle', 'other')),
  counterparty_name text,
  counterparty_address text,
  contract_number text,
  start_date date,
  notice_period_text text,          -- wörtlich aus dem Vertrag, keine Interpretation
  notice_period_certainty public.certainty,
  earliest_end_date date,           -- nur gesetzt, wenn aus Vertrag/Recht belegt
  earliest_end_certainty public.certainty,
  required_form text check (required_form in ('schriftform', 'textform', 'online_button', 'unknown')),
  amount_minor bigint check (amount_minor >= 0),
  currency char(3),
  billing_interval text check (billing_interval in ('monthly', 'quarterly', 'yearly', 'one_off', 'unknown')),
  next_debit_on date,
  deposit_minor bigint,
  is_demo boolean not null default false,
  certainty public.certainty not null default 'detected',
  source_document_id uuid references public.documents (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint contracts_amount_currency check ((amount_minor is null) = (currency is null))
);
create index contracts_user on public.contracts (user_id) where deleted_at is null;
create trigger contracts_updated before update on public.contracts
  for each row execute function app.set_updated_at();

create table public.cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  status public.cancellation_status not null default 'DETECTED',
  is_demo boolean not null default false,
  dispatch_channel text check (dispatch_channel in ('postal_registered', 'postal_courier', 'email', 'online_button', 'in_person')),
  draft_subject text,
  draft_body text,
  draft_sha256 text,                -- automatisch berechnet; jede Änderung macht Freigaben ungültig
  checks jsonb not null default '{}'::jsonb,           -- rechtliche/Versand-Prüfpunkte mit Status
  closure_checklist jsonb not null default '{}'::jsonb, -- {"final_invoice":"done","deposit":"open","keys":"not_applicable"}
  blocked_reason text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index cancellation_requests_user on public.cancellation_requests (user_id, status);
-- Pro Vertrag höchstens ein aktiver (nicht abgeschlossener) Kündigungsvorgang
create unique index cancellation_one_active on public.cancellation_requests (contract_id)
  where status not in ('CLOSED') and deleted_at is null;

-- Freigaben: unveränderlich, gebunden an exakt einen Entwurfs-Hash
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subject_type text not null check (subject_type in ('cancellation', 'outbound_message', 'automation_rule')),
  subject_id uuid not null,
  content_sha256 text not null,
  statement text not null,          -- exakter Text, den der Nutzer bestätigt hat
  step_up_verified boolean not null,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now()
);
create index approvals_subject on public.approvals (subject_type, subject_id);

create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cancellation_request_id uuid references public.cancellation_requests (id),
  approval_id uuid references public.approvals (id),
  channel text not null check (channel in ('email', 'postal', 'sms', 'voice', 'push', 'in_app')),
  mode text not null check (mode in ('simulated', 'real')),
  recipient text,                   -- bei Simulation leer erlaubt
  subject text,
  body_sha256 text not null,
  status text not null default 'queued' check (status in ('queued', 'dispatched', 'failed', 'bounced', 'delivered')),
  provider_message_id text,
  idempotency_key text not null,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  unique (user_id, idempotency_key)
);
-- Doppelversand verhindern: pro Kündigung max. eine echte, nicht fehlgeschlagene Nachricht
create unique index outbound_one_real_per_cancellation on public.outbound_messages (cancellation_request_id)
  where mode = 'real' and status in ('queued', 'dispatched', 'delivered');

-- ---------------------------------------------------------------------------
-- Guards
-- ---------------------------------------------------------------------------
create or replace function app.cancellation_guard() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_hash text;
  v_open_items integer;
begin
  if (select user_id from public.contracts where id = new.contract_id) is distinct from new.user_id then
    raise exception 'Vertrag gehört nicht dem Nutzer';
  end if;
  if new.is_demo is distinct from (select is_demo from public.contracts where id = new.contract_id) then
    raise exception 'Demo-Kündigung nur für Demo-Vertrag (und umgekehrt)';
  end if;

  v_hash := case when new.draft_body is null then null
            else encode(digest(coalesce(new.draft_subject, '') || E'\n\n' || new.draft_body, 'sha256'), 'hex') end;

  if tg_op = 'INSERT' then
    if new.status not in ('DETECTED', 'TERMS_REVIEW', 'DRAFT') then
      raise exception 'Neue Kündigung startet in DETECTED/TERMS_REVIEW/DRAFT';
    end if;
    new.draft_sha256 := v_hash;
    perform app.log_audit(new.user_id, 'user', 'cancellation.created', 'cancellation_request', new.id,
      jsonb_build_object('status', new.status, 'is_demo', new.is_demo));
    return new;
  end if;

  if new.user_id <> old.user_id or new.contract_id <> old.contract_id or new.is_demo <> old.is_demo then
    raise exception 'Identität der Kündigung ist unveränderlich';
  end if;

  -- Entwurf geändert? Dann Hash neu und ggf. Freigabe verwerfen
  if v_hash is distinct from old.draft_sha256 then
    if old.status in ('SENT', 'DELIVERY_EVIDENCE', 'CONFIRMED', 'CLOSED') then
      raise exception 'Versendeter Entwurf ist unveränderlich';
    end if;
    new.draft_sha256 := v_hash;
    if old.status in ('USER_REVIEW', 'APPROVED') and new.status = old.status then
      new.status := 'DRAFT';
    end if;
  else
    new.draft_sha256 := old.draft_sha256;
  end if;

  if new.status <> old.status then
    if not exists (select 1 from app.cancellation_transitions where from_status = old.status and to_status = new.status)
       and not (old.status in ('USER_REVIEW', 'APPROVED') and new.status = 'DRAFT') then
      raise exception 'Ungültiger Kündigungs-Statuswechsel % -> %', old.status, new.status using errcode = 'check_violation';
    end if;

    if new.status = 'USER_REVIEW' and (new.draft_body is null or new.dispatch_channel is null) then
      raise exception 'Zur Prüfung braucht es Entwurf und Versandweg';
    end if;

    if new.status = 'APPROVED' and not exists (
        select 1 from public.approvals a
         where a.subject_type = 'cancellation' and a.subject_id = new.id
           and a.content_sha256 = new.draft_sha256 and a.step_up_verified
           and a.is_simulated = new.is_demo
           and a.created_at > now() - interval '15 minutes') then
      raise exception 'APPROVED erfordert frische, entwurfsgebundene Freigabe mit Step-up' using errcode = 'check_violation';
    end if;

    if new.status = 'SENT' and not exists (
        select 1 from public.outbound_messages m
         where m.cancellation_request_id = new.id and m.status in ('dispatched', 'delivered')
           and m.body_sha256 = new.draft_sha256
           and m.mode = case when new.is_demo then 'simulated' else 'real' end) then
      raise exception 'SENT erfordert einen tatsächlichen (bzw. bei Demo simulierten) Versandnachweis' using errcode = 'check_violation';
    end if;

    if new.status = 'CLOSED' then
      select count(*) into v_open_items from jsonb_each_text(new.closure_checklist) e
       where e.value not in ('done', 'not_applicable');
      if v_open_items > 0 or new.closure_checklist = '{}'::jsonb then
        raise exception 'Abschluss-Checkliste unvollständig (% offen)', v_open_items using errcode = 'check_violation';
      end if;
    end if;

    perform app.log_audit(new.user_id, coalesce(auth.jwt() ->> 'actor', 'user'), 'cancellation.status',
      'cancellation_request', new.id, jsonb_build_object('from', old.status, 'to', new.status, 'is_demo', new.is_demo));
  end if;

  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;
create trigger cancellation_guard before insert or update on public.cancellation_requests
  for each row execute function app.cancellation_guard();

create or replace function app.approvals_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'Freigaben sind unveränderlich';
end $$;
create trigger approvals_no_change before update or delete on public.approvals
  for each row execute function app.approvals_immutable();

create or replace function app.outbound_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  c public.cancellation_requests;
begin
  if new.cancellation_request_id is not null then
    select * into c from public.cancellation_requests where id = new.cancellation_request_id;
    if c.user_id <> new.user_id then raise exception 'fremde Kündigung'; end if;
    if c.is_demo and new.mode = 'real' then
      raise exception 'Demo-Kündigungen dürfen niemals echt versendet werden' using errcode = 'insufficient_privilege';
    end if;
    if tg_op = 'INSERT' and c.status <> 'APPROVED' then
      raise exception 'Versand nur nach Freigabe (Status APPROVED)';
    end if;
  end if;
  if tg_op = 'INSERT' and new.mode = 'real' and new.approval_id is null then
    raise exception 'Echter Versand ohne Freigabe-Referenz ist verboten';
  end if;
  if tg_op = 'UPDATE' and (new.body_sha256 <> old.body_sha256 or new.mode <> old.mode or new.user_id <> old.user_id) then
    raise exception 'Inhalt/Modus einer Ausgangsnachricht ist unveränderlich';
  end if;
  perform app.log_audit(new.user_id, 'worker', 'outbound.' || lower(tg_op) || '.' || new.status, 'outbound_message', new.id,
    jsonb_build_object('mode', new.mode, 'channel', new.channel));
  return new;
end $$;
create trigger outbound_guard before insert or update on public.outbound_messages
  for each row execute function app.outbound_guard();

-- Nutzerfunktion: Freigabe erteilen (verlangt aal2 + frisches Step-up)
create or replace function app.approve_cancellation(p_id uuid, p_expected_sha256 text, p_statement text)
returns uuid language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  c public.cancellation_requests;
  v_approval uuid;
begin
  select * into c from public.cancellation_requests where id = p_id and user_id = auth.uid() for update;
  if c.id is null then raise exception 'nicht gefunden'; end if;
  if c.status <> 'USER_REVIEW' then raise exception 'Freigabe nur im Status USER_REVIEW möglich'; end if;
  if c.draft_sha256 is distinct from p_expected_sha256 then
    raise exception 'Entwurf hat sich geändert – bitte erneut prüfen';
  end if;
  if not app.step_up_recent(interval '10 minutes') then
    raise exception 'Bitte erneut mit Authenticator bestätigen (Step-up)' using errcode = 'insufficient_privilege';
  end if;
  if length(coalesce(p_statement, '')) < 10 then raise exception 'Bestätigungstext fehlt'; end if;
  insert into public.approvals (user_id, subject_type, subject_id, content_sha256, statement, step_up_verified, is_simulated)
  values (c.user_id, 'cancellation', c.id, c.draft_sha256, p_statement, true, c.is_demo)
  returning id into v_approval;
  update public.cancellation_requests set status = 'APPROVED' where id = c.id;
  perform app.log_audit(c.user_id, 'user', 'cancellation.approved', 'cancellation_request', c.id,
    jsonb_build_object('approval_id', v_approval, 'is_demo', c.is_demo));
  return v_approval;
end $$;
revoke all on function app.approve_cancellation(uuid, text, text) from public;
grant execute on function app.approve_cancellation(uuid, text, text) to authenticated;

-- Demo: simulierter Versand. Erzeugt KEINE echte Nachricht, nur einen markierten Eintrag.
create or replace function app.simulate_send_demo_cancellation(p_id uuid)
returns uuid language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  c public.cancellation_requests;
  v_msg uuid;
  v_approval uuid;
begin
  select * into c from public.cancellation_requests where id = p_id and user_id = auth.uid() for update;
  if c.id is null then raise exception 'nicht gefunden'; end if;
  if not c.is_demo then raise exception 'Nur für Demo-Vorgänge' using errcode = 'insufficient_privilege'; end if;
  if c.status <> 'APPROVED' then raise exception 'Erst freigeben'; end if;
  select id into v_approval from public.approvals
   where subject_type = 'cancellation' and subject_id = c.id and content_sha256 = c.draft_sha256
   order by created_at desc limit 1;
  insert into public.outbound_messages (user_id, cancellation_request_id, approval_id, channel, mode, subject,
                                        body_sha256, status, idempotency_key, dispatched_at)
  values (c.user_id, c.id, v_approval, 'postal', 'simulated', c.draft_subject, c.draft_sha256, 'dispatched',
          'demo-cancel-' || c.id::text, now())
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_msg;
  if v_msg is null then raise exception 'Bereits (simuliert) versendet'; end if;
  update public.cancellation_requests set status = 'SENT' where id = c.id;
  return v_msg;
end $$;
revoke all on function app.simulate_send_demo_cancellation(uuid) from public;
grant execute on function app.simulate_send_demo_cancellation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Erinnerungen & Zustellversuche
-- ---------------------------------------------------------------------------
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  stage smallint not null default 0,         -- Eskalationsstufe 0..4
  channel text not null check (channel in ('in_app', 'push', 'email', 'sms', 'voice')),
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'skipped', 'cancelled', 'failed')),
  skip_reason text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index reminders_due on public.reminders (scheduled_for) where status = 'scheduled';

create table public.notification_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_id uuid references public.reminders (id) on delete set null,
  channel text not null,
  provider text,
  outcome text not null check (outcome in ('sent', 'failed', 'suppressed_quiet_hours', 'suppressed_rate_limit',
                                           'suppressed_no_consent', 'suppressed_paused', 'suppressed_kill_switch')),
  error_code text,
  created_at timestamptz not null default now()
);
create index notification_attempts_user_day on public.notification_attempts (user_id, created_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['contracts', 'cancellation_requests', 'approvals', 'outbound_messages', 'reminders', 'notification_attempts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_read', t);
    execute format('create policy %I on public.%I as restrictive for all to authenticated using (app.mfa_ok()) with check (app.mfa_ok())', t || '_mfa', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- Nutzer dürfen Verträge und Kündigungsentwürfe pflegen …
create policy contracts_insert on public.contracts for insert to authenticated with check (user_id = auth.uid());
create policy contracts_update on public.contracts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cancellation_insert on public.cancellation_requests for insert to authenticated with check (user_id = auth.uid());
create policy cancellation_update on public.cancellation_requests for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reminders_update on public.reminders for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.contracts, public.cancellation_requests to authenticated;
grant select, update on public.reminders to authenticated;  -- Snooze/Abbrechen
-- … aber Freigaben, Ausgangsnachrichten und Zustellversuche nur lesen (Schreiben via Funktionen/Worker)
grant select on public.approvals, public.outbound_messages, public.notification_attempts to authenticated;
