# DATA_MODEL

Konventionen: `uuid`-Schlüssel · `user_id` auf jeder Nutzerzeile (RLS) · Geld als `bigint` Kleinsteinheit + `char(3)` Währung · `certainty` (detected/inferred/verified) auf allem, was erkannt oder vermutet sein kann · Soft-Delete über `deleted_at` · Idempotenzschlüssel auf allem, was Jobs erzeugen · Zeit als `timestamptz` (UTC), Anzeige in der Zeitzone des Profils.

## Implementiert (Migrationen 0001–0005, getestet)
| Tabelle | Zweck | Besonderheiten |
|---|---|---|
| profiles | Profil, Zeitzone, Ruhezeiten, Tageslimit, Pause, Modus, Notaus | MFA-Policy |
| consent_records | Einwilligungen (anhängend, Widerruf = neue Zeile) | `app.has_consent()` |
| audit_events | Audit-Log | append-only, Hash-Kette, kein Inhalt im Payload |
| tasks | Aufgaben | Zustandsmaschine V2, Nachweispflicht, Priorität, Override, Snooze, Version |
| task_dependencies | Abhängigkeiten | Zyklen verboten, nur eigene Aufgaben |
| task_evidence | Nachweise | „nicht verfügbar" nur mit Begründung; Akzeptieren erst nach Virenscan |
| documents / document_versions | Dokumentenablage | Ordner-Liste aus Briefing, Zustände requested→uploaded→reviewed→officially_confirmed, MIME-Allowlist, SHA-256 (Dubletten), Pfad = `<user_id>/…` |
| upload_requests | Einmal-Upload-Links | Hash statt Token, ≤ 7 Tage, einmalig |
| contracts | Verträge/Abos | unbekannte Werte NULL, `notice_period_text` wörtlich, Demo-Flag |
| cancellation_requests | Kündigungs-Pipeline | Entwurfs-Hash, Checks, Abschluss-Checkliste, ein aktiver Vorgang je Vertrag |
| approvals | Freigaben | unveränderlich, an Hash gebunden, Step-up, simuliert-Flag |
| outbound_messages | Ausgang (alle Kanäle) | `simulated`/`real`, Idempotenz, Doppelversandschutz |
| reminders / notification_attempts | Erinnerungen und Zustellversuche | Unterdrückungsgründe protokolliert |
| accounts, imported_files, transactions, balances, fx_rates, liabilities | Finanzen | keine Zugangsdaten; Wallet nur öffentlich; Datei-Hash gegen Doppelimport; Dubletten markiert statt gelöscht |
| properties, mortgages | Immobilie | jede Angabe mit eigener `certainty`; Foto nur als belegtes Dokument |
| deletion_requests | Kontolöschung | Karenzzeit |

## Geplant (Briefing V1/V2 – noch nicht migriert)
identities, connections, oauth_tokens_encrypted, mail_threads, mail_messages, extracted_facts, fact_sources, subscriptions (derzeit in `contracts`), holdings, valuations, assets, relocation_items, shipping_quotes, provider_webhook_events, people, relationships, commitments, followups, appointments, routines, routine_occurrences, life_events, vehicles, warranties, deliveries, refunds, claims, health_documents (eigene Segregation + Consent), insurance_policies, renewal_events, knowledge_facts, knowledge_fact_provenance, capture_items, review_decisions, delegated_access, action_permissions, automation_rules, action_executions, communication_preferences, notification_limits (derzeit in `profiles`), external_wait_states, user_feedback, emergency_contacts.

## Aufbewahrung (Vorschlag, mit Sascha abzustimmen)
| Daten | Frist |
|---|---|
| Audit-Log | Lebensdauer des Kontos (Export möglich) |
| Kündigungen, Freigaben, Nachweise | mind. 3 Jahre nach Abschluss (Verjährung), dann Nachfrage |
| Kontoauszüge/Importe | bis Nutzer löscht; steuerrelevante Belege ggf. länger – **Steuerberater klären** |
| Upload-Links | 30 Tage nach Ablauf löschen |
| notification_attempts | 180 Tage |
