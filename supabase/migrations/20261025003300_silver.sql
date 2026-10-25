-- Silber (Münzen/Barren) in derselben Tabelle; Feingehalt 1000 für Positionen, die als reine Feinunzen geführt werden (z. B. eToro)
alter table public.gold_holdings drop constraint if exists gold_holdings_metal_check;
alter table public.gold_holdings add constraint gold_holdings_metal_check check (metal in ('gold', 'platinum', 'silver'));
