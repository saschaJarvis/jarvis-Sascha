-- Bauphase der Immobilie: steuert u. a. die LTV-Obergrenze (Off-Plan 50 %, fertig/übergeben je nach Käufer und Wert).
-- null = unbekannt (dann wird vorsichtig wie Off-Plan gerechnet).
alter table public.properties
  add column stage text check (stage in ('off_plan', 'handed_over')),
  add column stage_certainty public.certainty;

-- Sascha hat bestätigt: Beachwalk 3 by Imtiaz ist übergeben (kein Off-Plan mehr). Noch ohne Dokumentbeleg → 'inferred'.
update public.properties
   set stage = 'handed_over', stage_certainty = 'inferred', updated_at = now()
 where project_name = 'Beachwalk 3 by Imtiaz' and deleted_at is null and stage is null;
