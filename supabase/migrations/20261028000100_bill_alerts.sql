-- Zahlungserinnerungen (wiederkehrende Rechnungen) als eigene Warnungsart für Telegram/Push
alter table public.alerts drop constraint if exists alerts_kind_check;
alter table public.alerts add constraint alerts_kind_check check (kind in ('outflow', 'inflow', 'price', 'statement', 'bill', 'test'));
alter table public.alert_settings alter column kinds set default '{"outflow": true, "inflow": true, "price": true, "statement": true, "bill": true}'::jsonb;
update public.alert_settings set kinds = kinds || '{"bill": true}'::jsonb where not (kinds ? 'bill');
