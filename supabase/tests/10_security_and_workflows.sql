-- Sicherheits- und Workflow-Tests gegen das echte Schema.
-- Nutzer A = Sascha (fiktive Testidentität), Nutzer B = fremder Nutzer.
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-a000-00000000000a'''
\set B '''00000000-0000-4000-a000-00000000000b'''

-- Setup als Superuser (entspricht Supabase Auth)
insert into auth.users (id, email) values (:A, 'demo-a@example.invalid'), (:B, 'demo-b@example.invalid');
insert into public.profiles (id, display_name) values (:A, 'Demo A'), (:B, 'Demo B');

-- ===========================================================================
-- 1. RLS-Isolation
-- ===========================================================================
set role authenticated;
select test.login(:A);
insert into public.tasks (id, user_id, title, status) values
  ('10000000-0000-4000-a000-000000000001', :A, 'Lagerraum ausmessen', 'READY');

select test.login(:B);
select test.ok('rls: B sieht A-Aufgabe nicht', (select count(*) from public.tasks) = 0);
select test.ok('rls: B sieht A-Profil nicht', (select count(*) from public.profiles where id = :A) = 0);
with u as (update public.tasks set title = 'gehackt' where id = '10000000-0000-4000-a000-000000000001' returning 1)
select test.ok('rls: B kann A-Aufgabe nicht ändern', (select count(*) from u) = 0);
select test.throws('rls: B kann keine Aufgabe für A anlegen',
  $$insert into public.tasks (user_id, title) values ('00000000-0000-4000-a000-00000000000a', 'x')$$, '%row-level security%');
select test.ok('rls: B sieht A-Audit nicht', (select count(*) from public.audit_events where user_id = :A) = 0);

-- MFA-Pflicht: aal1 sieht nichts und darf nichts schreiben
select test.login(:A, 'aal1');
select test.ok('mfa: aal1 sieht keine Aufgaben', (select count(*) from public.tasks) = 0);
select test.throws('mfa: aal1 darf nicht schreiben',
  $$insert into public.tasks (user_id, title) values ('00000000-0000-4000-a000-00000000000a', 'x')$$, '%row-level security%');

reset role;
set role anon;
select test.throws('anon: kein Zugriff auf Aufgaben', $$select * from public.tasks$$, '%permission denied%');
select test.throws('anon: kein Zugriff auf Audit', $$select * from public.audit_events$$, '%permission denied%');
reset role;

-- ===========================================================================
-- 2. Aufgaben-Zustandsmaschine, Abhängigkeiten, Nachweise
-- ===========================================================================
set role authenticated;
select test.login(:A);
insert into public.tasks (id, user_id, title, status, evidence_required, evidence_hint) values
  ('10000000-0000-4000-a000-000000000002', :A, 'Büro kündigen', 'READY', true, 'Kündigungsbestätigung'),
  ('10000000-0000-4000-a000-000000000003', :A, 'Container buchen', 'READY', false, null);

select test.throws('task: READY -> VERIFIED ungültig',
  $$update public.tasks set status = 'VERIFIED' where id = '10000000-0000-4000-a000-000000000001'$$, '%Ungültiger Statuswechsel%');
select test.throws('task: neu direkt CLOSED verboten',
  $$insert into public.tasks (user_id, title, status) values ('00000000-0000-4000-a000-00000000000a', 'x', 'CLOSED')$$, '%starten in%');
select test.throws('task: Nachweispflicht – READY -> CLOSED verboten',
  $$update public.tasks set status = 'CLOSED' where id = '10000000-0000-4000-a000-000000000002'$$, '%verlangt Nachweis%');
select test.lives('task: READY -> EVIDENCE_PENDING',
  $$update public.tasks set status = 'EVIDENCE_PENDING' where id = '10000000-0000-4000-a000-000000000002'$$);
select test.throws('task: VERIFIED ohne akzeptierten Nachweis verboten',
  $$update public.tasks set status = 'VERIFIED' where id = '10000000-0000-4000-a000-000000000002'$$, '%akzeptierten Nachweis%');

-- Abhängigkeit: Container (3) hängt von Ausmessen (1) ab
insert into public.task_dependencies (task_id, depends_on_id, user_id)
  values ('10000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-000000000001', :A);
select test.throws('dep: Start trotz offener Vorbedingung verboten',
  $$update public.tasks set status = 'IN_PROGRESS' where id = '10000000-0000-4000-a000-000000000003'$$, '%offene Vorbedingung%');
select test.throws('dep: Zyklus verboten',
  $$insert into public.task_dependencies (task_id, depends_on_id, user_id) values
    ('10000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-00000000000a')$$, '%Zyklisch%');
select test.lives('dep: Vorbedingung erledigen',
  $$update public.tasks set status = 'CLOSED' where id = '10000000-0000-4000-a000-000000000001'$$);
select test.lives('dep: danach Start erlaubt',
  $$update public.tasks set status = 'IN_PROGRESS' where id = '10000000-0000-4000-a000-000000000003'$$);

-- Nachweis mit Dokument: erst nach Virenscan akzeptierbar
insert into public.documents (id, user_id, title, folder, state) values
  ('20000000-0000-4000-a000-000000000001', :A, 'Bestätigung Vermieter', 'office', 'uploaded');
insert into public.document_versions (id, document_id, user_id, version_no, storage_path, sha256, size_bytes, mime_type)
  values ('21000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', :A, 1,
          '00000000-0000-4000-a000-00000000000a/20000000-0000-4000-a000-000000000001/v1.pdf',
          repeat('ab', 32), 1234, 'application/pdf');
select test.throws('doc: Speicherpfad eines anderen Nutzers verboten',
  $$insert into public.document_versions (document_id, user_id, version_no, storage_path, sha256, size_bytes, mime_type)
    values ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-00000000000a', 2,
    '00000000-0000-4000-a000-00000000000b/x.pdf', repeat('cd', 32), 10, 'application/pdf')$$, '%storage_path_owned%');
select test.throws('doc: Nutzer darf Scan-Status nicht selbst setzen',
  $$insert into public.document_versions (document_id, user_id, version_no, storage_path, sha256, size_bytes, mime_type, scan_status)
    values ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-00000000000a', 3,
    '00000000-0000-4000-a000-00000000000a/y.pdf', repeat('ef', 32), 10, 'application/pdf', 'clean')$$, '%Scanner%');
select test.throws('doc: .exe-Upload abgelehnt',
  $$insert into public.document_versions (document_id, user_id, version_no, storage_path, sha256, size_bytes, mime_type)
    values ('20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-00000000000a', 4,
    '00000000-0000-4000-a000-00000000000a/z.exe', repeat('aa', 32), 10, 'application/x-msdownload')$$, '%mime_type%');
select test.throws('doc: "geprüft" ohne Virenscan verboten',
  $$update public.documents set state = 'reviewed' where id = '20000000-0000-4000-a000-000000000001'$$, '%virenfrei%');

insert into public.task_evidence (id, task_id, user_id, document_id, kind) values
  ('22000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000002', :A, '20000000-0000-4000-a000-000000000001', 'document');
select test.throws('evidence: Akzeptieren vor Virenscan verboten',
  $$update public.task_evidence set review = 'accepted' where id = '22000000-0000-4000-a000-000000000001'$$, '%virenfrei%');

reset role;
set role service_role;
update public.document_versions set scan_status = 'clean' where id = '21000000-0000-4000-a000-000000000001';
reset role;

set role authenticated;
select test.login(:A);
select test.lives('evidence: nach Scan akzeptieren',
  $$update public.task_evidence set review = 'accepted' where id = '22000000-0000-4000-a000-000000000001'$$);
select test.lives('task: EVIDENCE_PENDING -> VERIFIED', $$update public.tasks set status = 'VERIFIED' where id = '10000000-0000-4000-a000-000000000002'$$);
select test.lives('task: VERIFIED -> CLOSED', $$update public.tasks set status = 'CLOSED' where id = '10000000-0000-4000-a000-000000000002'$$);
select test.ok('task: closed_at gesetzt', (select closed_at is not null from public.tasks where id = '10000000-0000-4000-a000-000000000002'));
select test.throws('evidence: "nicht verfügbar" braucht Begründung',
  $$insert into public.task_evidence (task_id, user_id, kind) values
    ('10000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-00000000000a', 'not_available')$$, '%evidence_has_content%');

-- ===========================================================================
-- 3. Demo-Kündigung "Büromietvertrag Mainz" – Ende-zu-Ende ohne echten Versand
-- ===========================================================================
insert into public.contracts (id, user_id, name, category, is_demo, certainty, required_form) values
  ('30000000-0000-4000-a000-000000000001', :A, 'Büromietvertrag Mainz (BEISPIEL)', 'commercial_lease', true, 'inferred', 'unknown');
insert into public.cancellation_requests (id, user_id, contract_id, is_demo, status) values
  ('31000000-0000-4000-a000-000000000001', :A, '30000000-0000-4000-a000-000000000001', true, 'DETECTED');
update public.cancellation_requests set status = 'TERMS_REVIEW' where id = '31000000-0000-4000-a000-000000000001';
update public.cancellation_requests set status = 'DRAFT', draft_subject = 'Kündigung Büromietvertrag',
  draft_body = 'Sehr geehrte Damen und Herren, hiermit kündige ich …', dispatch_channel = 'postal_registered'
  where id = '31000000-0000-4000-a000-000000000001';
select test.lives('cancel: DRAFT -> USER_REVIEW', $$update public.cancellation_requests set status = 'USER_REVIEW' where id = '31000000-0000-4000-a000-000000000001'$$);
select test.throws('cancel: direktes APPROVED ohne Freigabe verboten',
  $$update public.cancellation_requests set status = 'APPROVED' where id = '31000000-0000-4000-a000-000000000001'$$, '%Freigabe%');
select test.throws('cancel: Nutzer kann Freigabe nicht direkt einfügen',
  $$insert into public.approvals (user_id, subject_type, subject_id, content_sha256, statement, step_up_verified)
    values ('00000000-0000-4000-a000-00000000000a', 'cancellation', '31000000-0000-4000-a000-000000000001', 'x', 'yyyyyyyyyyyy', true)$$, '%permission denied%');

select test.login(:A, 'aal1');
select test.throws('cancel: Freigabe ohne MFA verboten',
  $$select app.approve_cancellation('31000000-0000-4000-a000-000000000001',
     (select draft_sha256 from public.cancellation_requests where id = '31000000-0000-4000-a000-000000000001'), 'Ich gebe frei.')$$, '%');
select test.login(:A, 'aal2', 3600);
select test.throws('cancel: Freigabe mit veralteter MFA (60 Min) verboten',
  $$select app.approve_cancellation('31000000-0000-4000-a000-000000000001',
     (select draft_sha256 from public.cancellation_requests where id = '31000000-0000-4000-a000-000000000001'), 'Ich gebe frei.')$$, '%Step-up%');
select test.login(:A);
select test.throws('cancel: Freigabe mit falschem Entwurfs-Hash verboten',
  $$select app.approve_cancellation('31000000-0000-4000-a000-000000000001', repeat('0', 64), 'Ich gebe frei.')$$, '%geändert%');
select test.lives('cancel: frische Freigabe',
  $$select app.approve_cancellation('31000000-0000-4000-a000-000000000001',
     (select draft_sha256 from public.cancellation_requests where id = '31000000-0000-4000-a000-000000000001'),
     'Ich gebe diesen Entwurf zur (simulierten) Versendung frei.')$$);
select test.ok('cancel: Status APPROVED', (select status = 'APPROVED' from public.cancellation_requests where id = '31000000-0000-4000-a000-000000000001'));
select test.ok('cancel: Freigabe als simuliert markiert', (select bool_and(is_simulated) from public.approvals where subject_id = '31000000-0000-4000-a000-000000000001'));

-- Entwurf nach Freigabe ändern -> Freigabe verfällt
update public.cancellation_requests set draft_body = draft_body || ' (geändert)' where id = '31000000-0000-4000-a000-000000000001';
select test.ok('cancel: Änderung nach Freigabe setzt auf DRAFT zurück',
  (select status = 'DRAFT' from public.cancellation_requests where id = '31000000-0000-4000-a000-000000000001'));
update public.cancellation_requests set status = 'USER_REVIEW' where id = '31000000-0000-4000-a000-000000000001';
select app.approve_cancellation('31000000-0000-4000-a000-000000000001',
  (select draft_sha256 from public.cancellation_requests where id = '31000000-0000-4000-a000-000000000001'), 'Ich gebe den geänderten Entwurf frei.');

select test.throws('cancel: SENT ohne Versandnachweis verboten',
  $$update public.cancellation_requests set status = 'SENT' where id = '31000000-0000-4000-a000-000000000001'$$, '%Versandnachweis%');
select test.lives('cancel: simulierter Versand', $$select app.simulate_send_demo_cancellation('31000000-0000-4000-a000-000000000001')$$);
select test.ok('cancel: Status SENT (simuliert)', (select status = 'SENT' from public.cancellation_requests where id = '31000000-0000-4000-a000-000000000001'));
select test.ok('cancel: Ausgang ist mode=simulated', (select bool_and(mode = 'simulated') from public.outbound_messages where cancellation_request_id = '31000000-0000-4000-a000-000000000001'));
select test.throws('cancel: Doppelversand verhindert', $$select app.simulate_send_demo_cancellation('31000000-0000-4000-a000-000000000001')$$, '%');
select test.throws('cancel: versendeter Entwurf unveränderlich',
  $$update public.cancellation_requests set draft_body = 'neu' where id = '31000000-0000-4000-a000-000000000001'$$, '%unveränderlich%');

reset role;
set role service_role;
select test.throws('cancel: Demo kann nie echt versendet werden',
  $$insert into public.outbound_messages (user_id, cancellation_request_id, channel, mode, body_sha256, idempotency_key, approval_id)
    values ('00000000-0000-4000-a000-00000000000a', '31000000-0000-4000-a000-000000000001', 'email', 'real', 'x', 'k1',
    (select id from public.approvals limit 1))$$, '%niemals echt%');
reset role;

set role authenticated;
select test.login(:A);
update public.cancellation_requests set status = 'DELIVERY_EVIDENCE' where id = '31000000-0000-4000-a000-000000000001';
update public.cancellation_requests set status = 'CONFIRMED' where id = '31000000-0000-4000-a000-000000000001';
update public.cancellation_requests set closure_checklist = '{"final_invoice":"done","deposit":"open","keys":"done"}'
  where id = '31000000-0000-4000-a000-000000000001';
select test.throws('cancel: CLOSED mit offener Checkliste verboten',
  $$update public.cancellation_requests set status = 'CLOSED' where id = '31000000-0000-4000-a000-000000000001'$$, '%Checkliste%');
update public.cancellation_requests set closure_checklist = '{"final_invoice":"done","deposit":"done","keys":"not_applicable"}'
  where id = '31000000-0000-4000-a000-000000000001';
select test.lives('cancel: CLOSED mit vollständiger Checkliste',
  $$update public.cancellation_requests set status = 'CLOSED' where id = '31000000-0000-4000-a000-000000000001'$$);

-- Echter (Nicht-Demo-)Vorgang: Worker darf genau EINE echte Nachricht anlegen
insert into public.contracts (id, user_id, name, category) values
  ('30000000-0000-4000-a000-000000000002', :A, 'Streaming-Abo (Test)', 'subscription');
insert into public.cancellation_requests (id, user_id, contract_id, status, draft_subject, draft_body, dispatch_channel) values
  ('31000000-0000-4000-a000-000000000002', :A, '30000000-0000-4000-a000-000000000002', 'DRAFT', 'Kündigung', 'Text', 'email');
update public.cancellation_requests set status = 'USER_REVIEW' where id = '31000000-0000-4000-a000-000000000002';
select app.approve_cancellation('31000000-0000-4000-a000-000000000002',
  (select draft_sha256 from public.cancellation_requests where id = '31000000-0000-4000-a000-000000000002'), 'Ich gebe den Versand frei.');
select test.throws('cancel: Nutzer darf Demo-Simulation nicht für echten Vorgang nutzen',
  $$select app.simulate_send_demo_cancellation('31000000-0000-4000-a000-000000000002')$$, '%Nur für Demo%');
reset role;
set role service_role;
insert into public.outbound_messages (user_id, cancellation_request_id, approval_id, channel, mode, recipient, body_sha256, idempotency_key)
  select :A, c.id, (select id from public.approvals where subject_id = c.id), 'email', 'real', 'kuendigung@example.invalid', c.draft_sha256, 'send-' || c.id
  from public.cancellation_requests c where c.id = '31000000-0000-4000-a000-000000000002';
select test.throws('outbound: zweite echte Nachricht pro Kündigung verboten',
  $$insert into public.outbound_messages (user_id, cancellation_request_id, approval_id, channel, mode, body_sha256, idempotency_key)
    select '00000000-0000-4000-a000-00000000000a', c.id, (select id from public.approvals where subject_id = c.id), 'email', 'real', c.draft_sha256, 'send-2'
    from public.cancellation_requests c where c.id = '31000000-0000-4000-a000-000000000002'$$, '%outbound_one_real_per_cancellation%');
select test.throws('outbound: gleicher Idempotenz-Schlüssel verboten',
  $$insert into public.outbound_messages (user_id, channel, mode, body_sha256, idempotency_key)
    values ('00000000-0000-4000-a000-00000000000a', 'in_app', 'simulated', 'x', 'send-31000000-0000-4000-a000-000000000002')$$, '%duplicate key%');
select test.throws('outbound: echte Nachricht ohne Freigabe verboten',
  $$insert into public.outbound_messages (user_id, channel, mode, body_sha256, idempotency_key)
    values ('00000000-0000-4000-a000-00000000000a', 'email', 'real', 'x', 'k-noapproval')$$, '%ohne Freigabe%');
reset role;

-- ===========================================================================
-- 4. Einmal-Upload-Links
-- ===========================================================================
set role authenticated;
select test.login(:A);
insert into public.documents (id, user_id, title, folder, state) values
  ('20000000-0000-4000-a000-000000000002', :A, 'Kontoauszug Juni', 'banks', 'requested');
insert into public.upload_requests (user_id, document_id, requested_item, reason, token_hash, expires_at) values
  (:A, '20000000-0000-4000-a000-000000000002', 'Kontoauszug Juni', 'Abgleich Mietzahlung',
   encode(digest('gueltiger-token', 'sha256'), 'hex'), now() + interval '2 days');
select test.throws('upload: Nutzer kann Token nicht selbst einlösen', $$select * from app.redeem_upload_token('gueltiger-token')$$, '%permission denied%');
select test.throws('upload: Link max. 7 Tage gültig',
  $$insert into public.upload_requests (user_id, document_id, requested_item, reason, token_hash, expires_at) values
    ('00000000-0000-4000-a000-00000000000a', '20000000-0000-4000-a000-000000000002', 'x', 'y', repeat('1', 64), now() + interval '30 days')$$, '%upload_expiry_window%');
reset role;
-- abgelaufener Link (als Superuser zurückdatiert, um Zeitablauf zu simulieren)
insert into public.upload_requests (user_id, document_id, requested_item, reason, token_hash, expires_at, created_at) values
  (:A, '20000000-0000-4000-a000-000000000002', 'x', 'y', encode(digest('alter-token', 'sha256'), 'hex'), now() - interval '1 hour', now() - interval '2 days');
set role service_role;
select test.lives('upload: gültiger Token einlösbar', $$select * from app.redeem_upload_token('gueltiger-token')$$);
select test.throws('upload: Token nur einmal', $$select * from app.redeem_upload_token('gueltiger-token')$$, '%bereits benutzt%');
select test.throws('upload: abgelaufener Token', $$select * from app.redeem_upload_token('alter-token')$$, '%abgelaufen%');
select test.throws('upload: falscher Token', $$select * from app.redeem_upload_token('geraten')$$, '%ungültig%');
reset role;

-- ===========================================================================
-- 5. Audit-Log: unveränderlich und verkettet
-- ===========================================================================
set role authenticated;
select test.login(:A);
select test.ok('audit: Ereignisse protokolliert', (select count(*) from public.audit_events) >= 10);
select test.throws('audit: Nutzer kann nicht ändern', $$update public.audit_events set action = 'x'$$, '%permission denied%');
select test.throws('audit: Nutzer kann nicht löschen', $$delete from public.audit_events$$, '%permission denied%');
select test.throws('audit: Nutzer kann nicht direkt schreiben',
  $$insert into public.audit_events (user_id, actor, action, entity, prev_hash, hash) values ('00000000-0000-4000-a000-00000000000a','user','fake','x','','')$$, '%permission denied%');
select test.ok('audit: Kette intakt', app.verify_audit_chain(:A) is null);
select test.login(:B);
select test.throws('audit: B darf A-Kette nicht prüfen', $$select app.verify_audit_chain('00000000-0000-4000-a000-00000000000a')$$, '%nicht erlaubt%');
select test.login(:A);
select test.ok('audit: keine Entwurfstexte im Payload',
  not exists (select 1 from public.audit_events where payload::text ilike '%hiermit kündige%'));
reset role;
select test.throws('audit: auch Superuser kann per UPDATE nicht ändern', $$update public.audit_events set action = 'x'$$, '%unveränderlich%');
-- Manipulation simulieren (Trigger aus), Kette muss Bruch erkennen
alter table public.audit_events disable trigger audit_events_no_update;
update public.audit_events set payload = '{"manipuliert":true}'
 where seq = (select seq from public.audit_events where user_id = :A order by seq offset 2 limit 1);
alter table public.audit_events enable trigger audit_events_no_update;
select test.ok('audit: Manipulation wird erkannt', app.verify_audit_chain(:A) is not null);

-- ===========================================================================
-- 6. Datenexport, Krypto-Schutz, Freigaben unveränderlich
-- ===========================================================================
set role authenticated;
select test.login(:B);
insert into public.tasks (user_id, title) values (:B, 'B-Aufgabe');
select test.login(:A);
select test.ok('export: nur eigene Daten',
  (select jsonb_array_length(app.export_my_data() -> 'tasks')) = (select count(*) from public.tasks)
  and not (app.export_my_data()::text like '%B-Aufgabe%'));
select test.login(:A, 'aal2', 3600);
select test.throws('export: ohne frisches Step-up verboten', $$select app.export_my_data()$$, '%Step-up%');
select test.login(:A);
select test.throws('krypto: erweiterter privater Schlüssel abgelehnt',
  $$insert into public.accounts (user_id, name, kind, currency, public_wallet_address)
    values ('00000000-0000-4000-a000-00000000000a', 'Wallet', 'crypto_wallet', 'BTC', 'xprv9s21ZrQH143K')$$, '%no_secret_material%');
select test.throws('krypto: Seed-Phrase (mehrere Wörter) abgelehnt',
  $$insert into public.accounts (user_id, name, kind, currency, public_wallet_address)
    values ('00000000-0000-4000-a000-00000000000a', 'Wallet', 'crypto_wallet', 'BTC', 'abandon ability able about above absent')$$, '%no_secret_material%');
select test.lives('krypto: öffentliche Adresse erlaubt',
  $$insert into public.accounts (user_id, name, kind, currency, public_wallet_address)
    values ('00000000-0000-4000-a000-00000000000a', 'Wallet', 'crypto_wallet', 'BTC', 'bc1qexampleexampleexampleexample0000')$$);
reset role;
select test.throws('approvals: unveränderlich (auch Superuser)', $$update public.approvals set statement = 'x'$$, '%unveränderlich%');
