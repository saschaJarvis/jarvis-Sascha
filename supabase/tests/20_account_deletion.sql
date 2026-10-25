-- Konto löschen: Audit/Freigaben bleiben für bestehende Konten unveränderlich, aber ein gelöschtes Konto
-- reißt seine Daten vollständig mit (keine Waisen).
\set D '''00000000-0000-4000-a000-0000000000de'''
insert into auth.users (id, email) values (:D, 'loeschen@example.invalid');
select app.log_audit(:D, 'user', 'test.event', 'profile', null, '{}'::jsonb);
select test.throws('löschen: Audit-Zeile eines bestehenden Kontos bleibt geschützt',
  $$delete from public.audit_events where user_id = '00000000-0000-4000-a000-0000000000de'$$, '%unveränderlich%');
select test.ok('löschen: Audit-Zeile noch da', (select count(*) from public.audit_events where user_id = :D) = 1);
delete from auth.users where id = :D;
select test.ok('löschen: Konto samt Audit-Zeilen entfernt',
  not exists (select 1 from auth.users where id = :D) and not exists (select 1 from public.audit_events where user_id = :D));
