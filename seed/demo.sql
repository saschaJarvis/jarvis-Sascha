-- DEMO-DATEN – Aufgaben und Vertrag sind FIKTIVE Beispiele (Titel beginnen mit „BEISPIEL").
-- Einzige Ausnahme: die Immobilien-Zeile übernimmt Saschas eigene Angaben aus dem Briefing und ist
-- deshalb überall als „vermutet" (inferred) markiert, bis Kaufvertrag/Bankunterlagen sie belegen.
-- Keine Dokumente, Kontodaten oder Fotos.
-- Aufruf: psql -v uid="'<auth-user-uuid>'" -f seed/demo.sql   (als service_role/postgres)

-- Profil mit Umzugsdatum = unbestätigt
update public.profiles set moving_date = null, moving_date_certainty = null, onboarding = jsonb_build_object('demo', true)
 where id = :uid;

insert into public.tasks (user_id, title, why, domain, status, urgency, impact, effort_minutes, next_step, evidence_required, evidence_hint, certainty, idempotency_key) values
  (:uid, 'BEISPIEL: Lagerraum ausmessen und fotografieren', 'Ohne gemessene Kubikmeter kein seriöses Containerangebot.', 'relocation', 'READY', 2, 3, 30,
   'Zollstock einpacken, Länge × Breite × Höhe notieren, 4 Fotos machen', true, 'Notiz mit Maßen oder Foto', 'verified', 'demo-1'),
  (:uid, 'BEISPIEL: Drei Umzugsangebote anfragen', 'Vergleich von Preis, Versicherung und Zollabwicklung.', 'relocation', 'READY', 2, 3, 45,
   'Liste mit 3 internationalen Umzugsfirmen öffnen', false, null, 'verified', 'demo-2'),
  (:uid, 'BEISPIEL: Büromietvertrag Mainz – Kündigung vorbereiten', 'Laufende Miete nach dem Umzug vermeiden. Frist unbekannt – erst im Vertrag nachlesen.', 'contracts', 'READY', 3, 3, 15,
   'Mietvertrag heraussuchen und Seite mit „Kündigung" fotografieren', true, 'Schriftliche Kündigungsbestätigung des Vermieters', 'verified', 'demo-3'),
  (:uid, 'BEISPIEL: Steuerberater-Termin zum Wegzug vereinbaren', 'Wegzug ins Ausland kann steuerliche Folgen haben – nur ein Berater kann das klären.', 'relocation', 'READY', 2, 3, 10,
   'Steuerberater anrufen und Termin erfragen', false, null, 'verified', 'demo-4'),
  (:uid, 'BEISPIEL: Offene Rechnungen prüfen', 'Zahlungen nicht verpassen.', 'finance', 'NEEDS_REVIEW', 1, 2, 10,
   'Kontoauszug als CSV exportieren und hochladen', false, null, 'inferred', 'demo-5')
on conflict (user_id, idempotency_key) do nothing;

-- Container buchen hängt vom Ausmessen ab
insert into public.tasks (user_id, title, why, domain, status, urgency, impact, effort_minutes, next_step, certainty, idempotency_key)
values (:uid, 'BEISPIEL: Container buchen', 'Erst nach Volumenmessung und Angebotsvergleich.', 'relocation', 'READY', 2, 3, 30,
        'Angebote vergleichen', 'verified', 'demo-6')
on conflict (user_id, idempotency_key) do nothing;
insert into public.task_dependencies (task_id, depends_on_id, user_id)
select c.id, m.id, :uid from public.tasks c, public.tasks m
 where c.user_id = :uid and m.user_id = :uid and c.idempotency_key = 'demo-6' and m.idempotency_key = 'demo-1'
on conflict do nothing;

-- Demo-Vertrag: alle unbekannten Werte bleiben leer
insert into public.contracts (user_id, name, category, is_demo, certainty, required_form)
select :uid, 'Büromietvertrag Mainz (BEISPIEL)', 'commercial_lease', true, 'inferred', 'unknown'
 where not exists (select 1 from public.contracts where user_id = :uid and is_demo and category = 'commercial_lease');

-- Immobilie: Angaben aus dem Briefing, als "vermutet" markiert bis zum Dokumentbeleg. Kein Foto.
insert into public.properties (user_id, project_name, developer, location, size_sqft, size_certainty, view_text, view_certainty,
                               financing_ltv_pct, financing_certainty)
select :uid, 'Beach Walk Tower 3', 'Imtiaz', 'Dubai Islands', 880, 'inferred', 'Meerblick (laut Angabe)', 'inferred', 60, 'inferred'
 where not exists (select 1 from public.properties where user_id = :uid);
