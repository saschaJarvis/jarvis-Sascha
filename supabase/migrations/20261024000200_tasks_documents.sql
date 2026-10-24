-- Jarvis Sascha – Migration 0002: Aufgaben, Abhängigkeiten, Nachweise, Dokumente, Upload-Links (P1)

-- ---------------------------------------------------------------------------
-- Aufgaben-Zustandsmaschine (V2)
-- ---------------------------------------------------------------------------
create type public.task_status as enum (
  'DETECTED', 'NEEDS_REVIEW', 'READY', 'IN_PROGRESS',
  'WAITING_FOR_USER', 'WAITING_FOR_THIRD_PARTY', 'EVIDENCE_PENDING',
  'VERIFIED', 'CLOSED', 'BLOCKED', 'DISPUTED', 'CANCELLED'
);

-- Erlaubte Übergänge als Daten. Dieselbe Tabelle existiert in src/lib/domain/taskStateMachine.ts;
-- ein Test (scripts/check-transition-parity.ts) stellt sicher, dass beide identisch sind.
create table app.task_transitions (
  from_status public.task_status not null,
  to_status public.task_status not null,
  primary key (from_status, to_status)
);
insert into app.task_transitions (from_status, to_status) values
  ('DETECTED', 'NEEDS_REVIEW'), ('DETECTED', 'READY'), ('DETECTED', 'CANCELLED'),
  ('NEEDS_REVIEW', 'READY'), ('NEEDS_REVIEW', 'CANCELLED'),
  ('READY', 'IN_PROGRESS'), ('READY', 'WAITING_FOR_USER'), ('READY', 'WAITING_FOR_THIRD_PARTY'),
  ('READY', 'EVIDENCE_PENDING'), ('READY', 'BLOCKED'), ('READY', 'CLOSED'), ('READY', 'CANCELLED'),
  ('IN_PROGRESS', 'READY'), ('IN_PROGRESS', 'WAITING_FOR_USER'), ('IN_PROGRESS', 'WAITING_FOR_THIRD_PARTY'),
  ('IN_PROGRESS', 'EVIDENCE_PENDING'), ('IN_PROGRESS', 'BLOCKED'), ('IN_PROGRESS', 'CLOSED'), ('IN_PROGRESS', 'CANCELLED'),
  ('WAITING_FOR_USER', 'IN_PROGRESS'), ('WAITING_FOR_USER', 'READY'), ('WAITING_FOR_USER', 'EVIDENCE_PENDING'),
  ('WAITING_FOR_USER', 'BLOCKED'), ('WAITING_FOR_USER', 'CANCELLED'),
  ('WAITING_FOR_THIRD_PARTY', 'IN_PROGRESS'), ('WAITING_FOR_THIRD_PARTY', 'READY'), ('WAITING_FOR_THIRD_PARTY', 'EVIDENCE_PENDING'),
  ('WAITING_FOR_THIRD_PARTY', 'BLOCKED'), ('WAITING_FOR_THIRD_PARTY', 'CANCELLED'),
  ('EVIDENCE_PENDING', 'VERIFIED'), ('EVIDENCE_PENDING', 'IN_PROGRESS'), ('EVIDENCE_PENDING', 'DISPUTED'), ('EVIDENCE_PENDING', 'BLOCKED'),
  ('VERIFIED', 'CLOSED'), ('VERIFIED', 'DISPUTED'),
  ('BLOCKED', 'READY'), ('BLOCKED', 'IN_PROGRESS'), ('BLOCKED', 'CANCELLED'),
  ('DISPUTED', 'IN_PROGRESS'), ('DISPUTED', 'EVIDENCE_PENDING'), ('DISPUTED', 'CANCELLED'),
  ('CLOSED', 'READY'),      -- Wiederöffnen, Historie bleibt erhalten
  ('CANCELLED', 'READY');
grant select on app.task_transitions to authenticated, service_role;

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(title) between 1 and 300),
  why text,                               -- WARUM (für die universelle Detailansicht)
  domain text not null default 'general', -- 'relocation', 'finance', 'contracts', 'documents', 'property', ...
  owner text not null default 'self' check (owner in ('self', 'helper', 'jarvis', 'third_party')),
  status public.task_status not null default 'READY',
  due_at timestamptz,
  due_is_hard boolean not null default false,       -- gesetzliche/vertragliche Frist (nur wenn belegt)
  urgency smallint not null default 2 check (urgency between 0 and 3),   -- 0 niedrig … 3 kritisch
  impact smallint not null default 2 check (impact between 0 and 3),
  money_at_risk_minor bigint check (money_at_risk_minor >= 0),
  money_currency char(3),
  effort_minutes integer check (effort_minutes between 1 and 10000),
  evidence_required boolean not null default false,
  evidence_hint text,                     -- z. B. 'Kündigungsbestätigung des Vermieters'
  next_step text,                         -- EINE konkrete nächste Handlung (5–15 Min.)
  prepared_by_jarvis jsonb not null default '{}'::jsonb,
  escalation_policy text not null default 'standard' check (escalation_policy in ('none', 'gentle', 'standard', 'critical')),
  certainty public.certainty not null default 'verified',
  source_ref jsonb,                       -- Herkunft (Dokument-ID, Mail-ID …)
  user_priority_override smallint check (user_priority_override between -3 and 3),
  snoozed_until timestamptz,
  idempotency_key text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  deleted_at timestamptz,
  constraint tasks_money_currency check ((money_at_risk_minor is null) = (money_currency is null)),
  constraint tasks_idem unique (user_id, idempotency_key)
);
create index tasks_user_open on public.tasks (user_id, status, due_at) where deleted_at is null;

create table public.task_dependencies (
  task_id uuid not null references public.tasks (id) on delete cascade,
  depends_on_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_id),
  constraint no_self_dependency check (task_id <> depends_on_id)
);
create index task_dependencies_dep on public.task_dependencies (depends_on_id);

-- ---------------------------------------------------------------------------
-- Dokumente & Versionen
-- ---------------------------------------------------------------------------
create type public.document_state as enum ('requested', 'uploaded', 'reviewed', 'officially_confirmed', 'rejected');
create type public.scan_status as enum ('pending', 'clean', 'infected', 'error');

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  folder text not null check (folder in (
    'identity', 'housing', 'office', 'storage', 'business', 'taxes', 'banks', 'crypto', 'insurance',
    'subscriptions', 'shipping', 'customs', 'visa', 'uae_property', 'utilities', 'healthcare', 'vehicles',
    'travel', 'legal', 'other')),
  tags text[] not null default '{}',
  state public.document_state not null default 'requested',
  sensitivity text not null default 'normal' check (sensitivity in ('normal', 'high', 'health')),
  expires_on date,
  issuer text,
  is_demo boolean not null default false,
  certainty public.certainty not null default 'detected',
  extracted jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index documents_user on public.documents (user_id, folder) where deleted_at is null;
create index documents_expiry on public.documents (user_id, expires_on) where deleted_at is null and expires_on is not null;

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version_no integer not null,
  storage_path text not null,             -- privater Bucket, Pfad beginnt mit user_id/
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),  -- max. 50 MB
  mime_type text not null check (mime_type in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'message/rfc822')),
  scan_status public.scan_status not null default 'pending',
  uploaded_via text not null default 'app' check (uploaded_via in ('app', 'upload_link', 'email')),
  created_at timestamptz not null default now(),
  unique (document_id, version_no),
  constraint storage_path_owned check (storage_path like user_id::text || '/%')
);
-- Dublettenerkennung: gleiche Datei (Hash) beim selben Nutzer
create index document_versions_hash on public.document_versions (user_id, sha256);

create table public.task_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid references public.documents (id),
  kind text not null check (kind in ('document', 'not_available', 'note')),
  note text,
  review text not null default 'pending' check (review in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint evidence_has_content check (
    (kind = 'document' and document_id is not null) or
    (kind in ('not_available', 'note') and note is not null and length(note) >= 3))
);
create index task_evidence_task on public.task_evidence (task_id);

-- ---------------------------------------------------------------------------
-- Einmal-Upload-Links (z. B. "Bitte Kontoauszug Juni hochladen")
-- Token wird nur als SHA-256-Hash gespeichert.
-- ---------------------------------------------------------------------------
create table public.upload_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  requested_item text not null,
  reason text not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint upload_expiry_window check (expires_at > created_at and expires_at <= created_at + interval '7 days')
);

-- ---------------------------------------------------------------------------
-- Trigger: Statuswechsel prüfen, Abhängigkeiten, Nachweise, Audit
-- ---------------------------------------------------------------------------
create or replace function app.tasks_guard() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_open_deps integer;
  v_accepted integer;
begin
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id then
      raise exception 'user_id darf nicht geändert werden';
    end if;
    if new.status <> old.status then
      if not exists (select 1 from app.task_transitions where from_status = old.status and to_status = new.status) then
        raise exception 'Ungültiger Statuswechsel % -> %', old.status, new.status using errcode = 'check_violation';
      end if;
      -- Abhängigkeiten: nicht starten/abschließen, solange Vorgänger offen
      if new.status in ('IN_PROGRESS', 'EVIDENCE_PENDING', 'VERIFIED', 'CLOSED') then
        select count(*) into v_open_deps
          from public.task_dependencies d join public.tasks t on t.id = d.depends_on_id
         where d.task_id = new.id and t.status not in ('CLOSED', 'VERIFIED', 'CANCELLED') and t.deleted_at is null;
        if v_open_deps > 0 then
          raise exception 'Aufgabe hat % offene Vorbedingung(en)', v_open_deps using errcode = 'check_violation';
        end if;
      end if;
      -- Nachweis: VERIFIED nur mit akzeptiertem Nachweis; CLOSED ohne VERIFIED nur, wenn kein Nachweis nötig
      if new.status = 'VERIFIED' then
        select count(*) into v_accepted from public.task_evidence where task_id = new.id and review = 'accepted';
        if v_accepted = 0 then
          raise exception 'VERIFIED erfordert mindestens einen akzeptierten Nachweis' using errcode = 'check_violation';
        end if;
      end if;
      if new.status = 'CLOSED' and old.status <> 'VERIFIED' and new.evidence_required then
        raise exception 'Aufgabe verlangt Nachweis – erst VERIFIED, dann CLOSED' using errcode = 'check_violation';
      end if;
      new.closed_at := case when new.status = 'CLOSED' then now() else null end;
      perform app.log_audit(new.user_id, coalesce(auth.jwt() ->> 'actor', 'user'), 'task.status', 'task', new.id,
        jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if new.deleted_at is not null and old.deleted_at is null then
      perform app.log_audit(new.user_id, 'user', 'task.soft_deleted', 'task', new.id, '{}'::jsonb);
    end if;
    new.version := old.version + 1;
    new.updated_at := now();
  else
    if new.status not in ('DETECTED', 'NEEDS_REVIEW', 'READY') then
      raise exception 'Neue Aufgaben starten in DETECTED, NEEDS_REVIEW oder READY' using errcode = 'check_violation';
    end if;
    perform app.log_audit(new.user_id, coalesce(auth.jwt() ->> 'actor', 'user'), 'task.created', 'task', new.id,
      jsonb_build_object('status', new.status, 'domain', new.domain, 'certainty', new.certainty));
  end if;
  return new;
end $$;
create trigger tasks_guard before insert or update on public.tasks
  for each row execute function app.tasks_guard();

-- Zyklen in Abhängigkeiten verhindern; beide Aufgaben müssen demselben Nutzer gehören
create or replace function app.task_dependencies_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cycle boolean;
begin
  if (select count(*) from public.tasks where id in (new.task_id, new.depends_on_id) and user_id = new.user_id) <> 2 then
    raise exception 'Abhängigkeit nur zwischen eigenen Aufgaben';
  end if;
  with recursive chain(id) as (
    select new.depends_on_id
    union
    select d.depends_on_id from public.task_dependencies d join chain c on d.task_id = c.id
  )
  select exists (select 1 from chain where id = new.task_id) into v_cycle;
  if v_cycle then
    raise exception 'Zyklische Abhängigkeit' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger task_dependencies_guard before insert or update on public.task_dependencies
  for each row execute function app.task_dependencies_guard();

-- Nachweise: Dokument muss dem Nutzer gehören und sauber gescannt sein, bevor er akzeptiert wird
create or replace function app.task_evidence_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select user_id from public.tasks where id = new.task_id) is distinct from new.user_id then
    raise exception 'Nachweis nur für eigene Aufgaben';
  end if;
  if new.document_id is not null and (select user_id from public.documents where id = new.document_id) is distinct from new.user_id then
    raise exception 'Nachweis-Dokument gehört nicht dem Nutzer';
  end if;
  if new.review = 'accepted' and new.kind = 'document' and not exists (
      select 1 from public.document_versions v where v.document_id = new.document_id and v.scan_status = 'clean') then
    raise exception 'Dokument noch nicht als virenfrei geprüft' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.review <> old.review then
    perform app.log_audit(new.user_id, 'user', 'evidence.review', 'task_evidence', new.id,
      jsonb_build_object('task_id', new.task_id, 'review', new.review));
  end if;
  return new;
end $$;
create trigger task_evidence_guard before insert or update on public.task_evidence
  for each row execute function app.task_evidence_guard();

-- Dokumentzustand: "reviewed"/"officially_confirmed" nur mit sauber gescannter Version
create or replace function app.documents_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' and new.user_id <> old.user_id then
    raise exception 'user_id darf nicht geändert werden';
  end if;
  if new.state in ('reviewed', 'officially_confirmed') and not exists (
      select 1 from public.document_versions v where v.document_id = new.id and v.scan_status = 'clean') then
    raise exception 'Dokument ohne geprüfte (virenfreie) Datei kann nicht als geprüft gelten' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and new.state <> old.state then
    perform app.log_audit(new.user_id, 'user', 'document.state', 'document', new.id,
      jsonb_build_object('from', old.state, 'to', new.state));
  end if;
  return new;
end $$;
create trigger documents_guard before insert or update on public.documents
  for each row execute function app.documents_guard();
create trigger documents_updated before update on public.documents
  for each row execute function app.set_updated_at();

-- Nur der Worker (service_role) darf das Scan-Ergebnis setzen
create or replace function app.document_versions_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (select user_id from public.documents where id = new.document_id) is distinct from new.user_id then
    raise exception 'Version nur für eigene Dokumente';
  end if;
  if tg_op = 'INSERT' and new.scan_status <> 'pending' and current_setting('role', true) = 'authenticated' then
    raise exception 'Scan-Status setzt nur der Scanner';
  end if;
  if tg_op = 'UPDATE' then
    if current_setting('role', true) = 'authenticated' then
      raise exception 'Versionen sind unveränderlich';
    end if;
    if new.scan_status <> old.scan_status then
      perform app.log_audit(new.user_id, 'worker', 'document.scanned', 'document_version', new.id,
        jsonb_build_object('scan_status', new.scan_status));
    end if;
  end if;
  return new;
end $$;
create trigger document_versions_guard before insert or update on public.document_versions
  for each row execute function app.document_versions_guard();

-- Upload-Token einlösen: atomar, einmalig, nur vor Ablauf. Liefert document_id + Speicherpfad-Präfix.
create or replace function app.redeem_upload_token(p_token text)
returns table (upload_request_id uuid, document_id uuid, user_id uuid, path_prefix text)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.upload_requests;
begin
  update public.upload_requests u set used_at = now()
   where u.token_hash = encode(digest(p_token, 'sha256'), 'hex')
     and u.used_at is null and u.expires_at > now()
  returning * into r;
  if r.id is null then
    raise exception 'Upload-Link ungültig, abgelaufen oder bereits benutzt' using errcode = 'invalid_authorization_specification';
  end if;
  perform app.log_audit(r.user_id, 'system', 'upload_link.redeemed', 'upload_request', r.id, '{}'::jsonb);
  return query select r.id, r.document_id, r.user_id, r.user_id::text || '/' || r.document_id::text || '/';
end $$;
revoke all on function app.redeem_upload_token(text) from public;
grant execute on function app.redeem_upload_token(text) to service_role;  -- nur Server-Route ruft auf

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['tasks', 'task_dependencies', 'task_evidence', 'documents', 'document_versions', 'upload_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = auth.uid())', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = auth.uid())', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_update', t);
    execute format('create policy %I on public.%I as restrictive for all to authenticated using (app.mfa_ok()) with check (app.mfa_ok())', t || '_mfa', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

grant select, insert, update on public.tasks, public.task_evidence, public.documents to authenticated;
grant select, insert, delete on public.task_dependencies to authenticated;
create policy task_dependencies_delete on public.task_dependencies for delete to authenticated using (user_id = auth.uid());
grant select, insert on public.document_versions to authenticated;
grant select, insert on public.upload_requests to authenticated;  -- Erzeugen ja, Einlösen nur serverseitig
