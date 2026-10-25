-- Konto löschen muss möglich sein (DSGVO Art. 17, Abwehr fremder Konten). Audit-Log und Freigaben bleiben
-- für bestehende Konten unveränderlich; nur wenn das Konto selbst gelöscht wurde (Kaskade aus auth.users),
-- dürfen dessen Zeilen mitgelöscht werden. UPDATE bleibt immer verboten.
create or replace function app.audit_immutable() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = old.user_id) then
    return old;
  end if;
  raise exception 'audit_events ist unveränderlich (append-only)' using errcode = 'insufficient_privilege';
end $$;

create or replace function app.approvals_immutable() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = old.user_id) then
    return old;
  end if;
  raise exception 'Freigaben sind unveränderlich';
end $$;
