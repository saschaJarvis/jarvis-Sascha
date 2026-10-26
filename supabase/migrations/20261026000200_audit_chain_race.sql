-- Audit-Kette: Wettlauf bei gleichzeitigen Einträgen beheben.
--
-- Ursache: seq (bigserial) wurde VOR der Nutzer-Sperre vergeben, der Vorgänger aber per „höchste seq“
-- gesucht. Bei parallelen Einfügungen (z. B. mehrere Aufgaben gleichzeitig) lag die seq-Reihenfolge daher
-- nicht in Ketten-Reihenfolge, und zwei Einträge konnten denselben Vorgänger bekommen (Verzweigung).
-- Kein Eintrag wurde verändert oder gelöscht – alle Hashes sind gültig.
--
-- 1) seq wird jetzt erst NACH der Sperre gezogen → seq-Reihenfolge = Ketten-Reihenfolge, keine Verzweigung mehr.
-- 2) Ein einmaliger Prüfpunkt („chain.checkpoint“) versiegelt alle offenen Enden der Altdaten in seinem
--    (selbst gehashten) Payload. Ab dem Prüfpunkt gilt wieder die strenge lineare Prüfung.
-- 3) verify_audit_chain prüft vor dem Prüfpunkt: jeder Hash gültig, genau ein GENESIS, jeder Vorgänger existiert,
--    jedes offene Ende ist im Prüfpunkt versiegelt. Danach: streng linear wie bisher.

create or replace function app.audit_chain() returns trigger
language plpgsql security definer set search_path = public, app, pg_temp as $$
declare
  v_prev text;
begin
  -- Serialisieren pro Nutzer, damit die Kette nicht verzweigt
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 42));
  -- Nummer erst unter der Sperre vergeben: so folgt seq exakt der Ketten-Reihenfolge
  new.seq := nextval(pg_get_serial_sequence('public.audit_events', 'seq'));
  select hash into v_prev from public.audit_events
   where user_id = new.user_id order by seq desc limit 1;
  new.prev_hash := coalesce(v_prev, 'GENESIS');
  new.created_at := clock_timestamp();
  new.hash := encode(extensions.digest(app.audit_hash_input(new.user_id, new.actor, new.action, new.entity,
                       new.entity_id, new.payload, new.created_at, new.prev_hash), 'sha256'), 'hex');
  return new;
end $$;

create or replace function app.verify_audit_chain(p_user uuid) returns bigint
language plpgsql stable security definer set search_path = public, app, pg_temp as $$
declare
  r record;
  v_prev text := 'GENESIS';
  v_cp bigint;
  v_tips jsonb;
  v_bad bigint;
begin
  -- Angemeldete Nutzer dürfen nur ihre eigene Kette prüfen; Worker (ohne sub) alle
  if auth.uid() is not null and auth.uid() <> p_user then
    raise exception 'nicht erlaubt' using errcode = 'insufficient_privilege';
  end if;

  -- a) Jeder Eintrag: Hash muss zum Inhalt passen
  select min(seq) into v_bad from public.audit_events e where e.user_id = p_user
    and e.hash <> encode(extensions.digest(app.audit_hash_input(e.user_id, e.actor, e.action,
        e.entity, e.entity_id, e.payload, e.created_at, e.prev_hash), 'sha256'), 'hex');
  if v_bad is not null then return v_bad; end if;

  select seq, payload->'tips' into v_cp, v_tips from public.audit_events
   where user_id = p_user and actor = 'system' and action = 'chain.checkpoint'
   order by seq desc limit 1;

  if v_cp is not null then
    -- b) Genau ein Anfang
    select seq into v_bad from public.audit_events where user_id = p_user and prev_hash = 'GENESIS'
     order by seq offset 1 limit 1;
    if v_bad is not null then return v_bad; end if;
    -- c) Jeder Vorgänger existiert in der Kette dieses Nutzers (bis einschließlich Prüfpunkt)
    select min(e.seq) into v_bad from public.audit_events e
     where e.user_id = p_user and e.seq <= v_cp and e.prev_hash <> 'GENESIS'
       and not exists (select 1 from public.audit_events p where p.user_id = p_user and p.hash = e.prev_hash and p.seq < v_cp);
    if v_bad is not null then return v_bad; end if;
    -- d) Jedes offene Ende vor dem Prüfpunkt ist im Prüfpunkt versiegelt (sonst könnte ein Ende fehlen)
    select min(e.seq) into v_bad from public.audit_events e
     where e.user_id = p_user and e.seq < v_cp
       and not exists (select 1 from public.audit_events n where n.user_id = p_user and n.prev_hash = e.hash)
       and not coalesce(v_tips, '[]'::jsonb) ? e.hash;
    if v_bad is not null then return v_bad; end if;
    select hash into v_prev from public.audit_events where seq = v_cp;
  end if;

  -- e) Ab dem Prüfpunkt (bzw. von Anfang an): streng linear
  for r in select seq, prev_hash, hash from public.audit_events
            where user_id = p_user and seq > coalesce(v_cp, 0) order by seq loop
    if r.prev_hash <> v_prev then return r.seq; end if;
    v_prev := r.hash;
  end loop;
  return null;
end $$;
revoke all on function app.verify_audit_chain(uuid) from public;
grant execute on function app.verify_audit_chain(uuid) to authenticated, service_role;

-- Einmaliger Prüfpunkt für jede Kette mit Verzweigungen aus dem Wettlauf
do $$
declare
  u record;
  v_tips jsonb;
begin
  for u in select distinct e.user_id from public.audit_events e
            where exists (select 1 from public.audit_events x where x.user_id = e.user_id
                          group by x.prev_hash having count(*) > 1) loop
    select coalesce(jsonb_agg(e.hash order by e.seq), '[]'::jsonb) into v_tips from public.audit_events e
     where e.user_id = u.user_id
       and not exists (select 1 from public.audit_events n where n.user_id = u.user_id and n.prev_hash = e.hash);
    perform app.log_audit(u.user_id, 'system', 'chain.checkpoint', 'audit', null,
      jsonb_build_object('reason', 'Verzweigung durch gleichzeitige Einträge (seq vor Sperre vergeben) – offene Enden versiegelt',
                         'tips', v_tips, 'tip_count', jsonb_array_length(v_tips)));
  end loop;
end $$;
