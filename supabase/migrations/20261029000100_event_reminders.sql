-- Termin-Erinnerungen: 1 Stunde vor jedem Termin aus den verbundenen Kalendern (iPhone/iCloud usw.).
-- Kanäle: Telegram-Nachricht (eigener Bot) + Telegram-Anruf mit Sprachansage über CallMeBot (api.callmebot.com).
alter table public.alerts drop constraint if exists alerts_kind_check;
alter table public.alerts add constraint alerts_kind_check check (kind in ('outflow', 'inflow', 'price', 'statement', 'bill', 'sport', 'event', 'test'));
-- Text, der beim Anruf vorgelesen wird (CallMeBot: max. 256 Zeichen); null = kein Anruf
alter table public.alerts add column if not exists call_text text check (call_text is null or length(call_text) <= 256);
alter table public.alerts add column if not exists call_ok boolean;
-- Telegram-Benutzername, den CallMeBot anruft (vorher in Telegram bei @CallMeBot_txtbot /start senden)
alter table public.alert_settings add column if not exists call_user text check (call_user is null or call_user ~ '^@[A-Za-z0-9_]{5,32}$');
alter table public.alert_settings add column if not exists event_lead_min integer not null default 60 check (event_lead_min between 5 and 1440);
alter table public.alert_settings alter column kinds set default '{"outflow": true, "inflow": true, "price": true, "statement": true, "bill": true, "sport": true, "event": true}'::jsonb;
update public.alert_settings set kinds = kinds || '{"event": true}'::jsonb where not (kinds ? 'event');
