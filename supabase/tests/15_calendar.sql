-- Externe Kalender: nur eigene, MFA-Pflicht, nur https, Limit, Audit ohne URL
\set ON_ERROR_STOP on
\set A '''00000000-0000-4000-a000-00000000000a'''
\set B '''00000000-0000-4000-a000-00000000000b'''

set role authenticated;
select test.login(:A);
select test.lives('kalender: eigenen Link speichern',
  $$insert into public.calendar_sources (user_id, name, provider, url)
    values ('00000000-0000-4000-a000-00000000000a', 'Privat', 'icloud', 'https://p01-caldav.icloud.com/published/2/abc')$$);
select test.throws('kalender: nur https', $$insert into public.calendar_sources (user_id, name, provider, url)
    values ('00000000-0000-4000-a000-00000000000a', 'X', 'icloud', 'http://p01-caldav.icloud.com/published/2/x')$$, '%check%');
select test.throws('kalender: nicht für andere anlegen', $$insert into public.calendar_sources (user_id, name, provider, url)
    values ('00000000-0000-4000-a000-00000000000b', 'X', 'icloud', 'https://p01-caldav.icloud.com/published/2/y')$$, '%row-level security%');
select test.login(:B);
select test.ok('kalender: fremder Link unsichtbar', (select count(*) from public.calendar_sources) = 0);
select test.login(:A, 'aal1');
select test.ok('kalender: ohne Authenticator unsichtbar', (select count(*) from public.calendar_sources) = 0);
select test.login(:A);
select test.ok('kalender: Audit ohne URL',
  exists (select 1 from public.audit_events where action = 'calendar.connected' and not (payload::text like '%caldav%')));
reset role;
insert into public.calendar_sources (user_id, name, provider, url)
  select '00000000-0000-4000-a000-00000000000a', 'K' || g, 'google', 'https://calendar.google.com/calendar/ical/x' || g || '/basic.ics' from generate_series(1, 9) g;
select test.throws('kalender: höchstens 10', $$insert into public.calendar_sources (user_id, name, provider, url)
    values ('00000000-0000-4000-a000-00000000000a', 'Z', 'google', 'https://calendar.google.com/calendar/ical/z/basic.ics')$$, '%Höchstens 10%');
