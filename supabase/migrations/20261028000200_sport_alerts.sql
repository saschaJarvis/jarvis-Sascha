-- Werder-Spiele (Vorschau, Anpfiff, Ergebnis) als Warnungsart
alter table public.alerts drop constraint if exists alerts_kind_check;
alter table public.alerts add constraint alerts_kind_check check (kind in ('outflow', 'inflow', 'price', 'statement', 'bill', 'sport', 'test'));
alter table public.alert_settings alter column kinds set default '{"outflow": true, "inflow": true, "price": true, "statement": true, "bill": true, "sport": true}'::jsonb;
update public.alert_settings set kinds = kinds || '{"sport": true}'::jsonb where not (kinds ? 'sport');
