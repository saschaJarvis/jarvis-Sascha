# Jarvis Sascha

Persönliches Betriebssystem für Sascha: Umzug Mainz → Dubai als erstes Projekt, danach dauerhafter „Chief of Staff" für Fristen, Rechnungen, Verträge, Dokumente und Alltag. Deutsch zuerst, mobil zuerst, **eine** nächste Handlung statt Listenflut. Jarvis bereitet vor – Sascha gibt frei.

> **Stand 24.10.2026:** Fundament (Datenbank, Sicherheit, Kernlogik) gebaut und getestet. Die Oberfläche ist noch **nicht** gebaut, weil die Bauumgebung keine npm-Pakete laden durfte. Siehe Feature-Matrix – dort steht ehrlich, was läuft.

## Schnellstart (lokal)
Voraussetzungen: Node ≥ 22, PostgreSQL 16 (Client + Server).

```bash
# 1. Lokale Test-Datenbank (einmalig)
initdb -D ./.pgdata -U postgres --auth=trust
pg_ctl -D ./.pgdata -o "-p 54322 -k /tmp" -l ./.pgdata/log.txt start

# 2. Abhängigkeiten
npm install

# 3. Alle Tests (Unit + DB/RLS + Parität)
npm test
# einzeln:
npm run test:unit     # 43 Tests
npm run test:db       # 73 Tests gegen echtes Postgres
npm run test:parity   # Zustandsmaschinen TS == SQL
npm run typecheck
```

Gegen ein echtes Supabase-Projekt: Migrationen aus `supabase/migrations/` in Reihenfolge einspielen (`supabase db push` oder SQL-Editor). `supabase/tests/00_local_supabase_stub.sql` **nicht** in Supabase ausführen – das bildet Supabase nur lokal nach.

**Demo-Login:** Es gibt kein fest eingebautes Passwort. Lokal: Nutzer in Supabase Auth anlegen, TOTP einrichten, dann `psql -v uid="'<user-uuid>'" -f seed/demo.sql` für fiktive Beispieldaten.

## Feature-Matrix
Legende: **TESTED** = gebaut und automatisch getestet · **IMPLEMENTED** = gebaut, ohne automatischen Test · **MOCKED** = Vorlage/Simulation · **BLOCKED** = wartet auf Zugang/Abhängigkeit · **PLANNED** = noch nicht begonnen

| Bereich | Funktion | Status |
|---|---|---|
| Sicherheit | RLS Cross-User-Isolation, MFA-Pflicht (aal2) auf allen Tabellen | TESTED |
| Sicherheit | Step-up (MFA ≤ 10 Min.) für Freigabe, Export, Löschung | TESTED |
| Sicherheit | Audit-Log append-only mit Hash-Kette, Manipulationserkennung | TESTED |
| Sicherheit | Upload-Links: gehasht, ≤ 7 Tage, einmalig, nur serverseitig einlösbar | TESTED |
| Sicherheit | Schutz gegen Seeds/Private Keys in Wallet-Feldern | TESTED |
| Sicherheit | Login-Oberfläche, TOTP-Einrichtung, Passkeys | BLOCKED (npm) |
| Sicherheit | Virenscanner-Worker | PLANNED (Gate in DB: TESTED) |
| Aufgaben | Zustandsmaschine V2, Nachweispflicht, Abhängigkeiten ohne Zyklen | TESTED |
| Aufgaben | Prioritäts-Engine mit Begründung, Heute-Ansicht (1 + 2), „überfordert"-Modus | TESTED (Logik) |
| Aufgaben | Schnellerfassung Deutsch („nächste Woche die Bank anrufen") | TESTED (Logik) |
| Aufgaben | Heute-Screen, Detailansicht, Bottom-Nav | BLOCKED (npm) |
| Dokumente | Schema, Ordner, Zustände, Versionen, Dubletten-Hash, MIME-Allowlist | TESTED |
| Dokumente | Upload in privaten Supabase-Bucket, signierte URLs | BLOCKED (npm/Supabase-Konto) |
| Kündigungen | Pipeline mit hashgebundener Freigabe, Doppelversandschutz, Abschluss-Checkliste | TESTED |
| Kündigungen | Demo „Büromietvertrag Mainz": simuliert, nie echter Versand | TESTED (DB) / BLOCKED (UI) |
| Kündigungen | Deutscher Entwurf ohne erfundene Daten, Prüfpunkte aus Recherche (Schriftform, Zugang, Befristung, Lager) | TESTED |
| Kündigungen | Echter Versand (E-Mail/Post) | PLANNED (P4) |
| Erinnerungen | Planer: Ruhezeiten, Tageslimit, Abstand, Stufen, Einwilligung, Pause, Snooze, Notaus, Sommerzeit | TESTED |
| Erinnerungen | Worker + E-Mail via Resend | BLOCKED (npm/Resend-Konto) |
| Erinnerungen | Push, SMS, Anruf | PLANNED |
| Finanzen | Beträge/Rundung exakt (BigInt), FX mit Datum/Quelle | TESTED |
| Finanzen | CSV-Import (generisch DE), Dubletten über Importe, Umbuchungen, Abo-Erkennung | TESTED (mit synthetischen Dateien) |
| Finanzen | Bank-spezifische Profile mit echten Exporten | MOCKED (Vorlage `generic_de`, unverifiziert) |
| Finanzen | Liquiditätsprognose 3 Szenarien, Tilgungsplan | TESTED |
| Finanzen | Krypto-Börsen-Adapter | PLANNED |
| Immobilie | Schema mit Gewissheit je Angabe, LTV-Plausibilität (CBUAE) | TESTED |
| Immobilie | Dashboard, Dokumententresor, Motivationsseite | PLANNED |
| Datenschutz | Export eigener Daten, Löschanfrage mit Karenz | TESTED (DB) |
| Inbox | Gmail/Outlook OAuth, Triage, Prompt-Injection-Schutz | PLANNED (P3) |
| Umzug | Recherche DE/UAE mit Quellen und 22 App-Regeln | IMPLEMENTED (Dokument) |
| Umzug | Checkliste/Abhängigkeitsvorlagen in der App | PLANNED |
| Assistent | Chat/Voice „Was muss ich heute machen?" | PLANNED |

## Dokumentation
`docs/PLAN.md` · `docs/ARCHITECTURE.md` · `docs/SECURITY.md` · `docs/DATA_MODEL.md` · `docs/TEST_PLAN.md` · `docs/ACCESS_CHECKLIST.md` · `docs/TASKS.md` · `docs/RESEARCH_DE_UAE.md`

## Grenzen (ehrlich)
- Keine Rechts- oder Steuerberatung. Recherche-Regeln sind als Prüfpunkte umgesetzt und tragen Quelle + Abrufdatum.
- Bank-CSV-Profile sind erst nach Test mit echten Exporten verlässlich.
- Tilgungsplan ist eine Prognose; verbindlich ist der Plan der Bank.
- `package.json`-Versionen sind noch nicht installiert/verifiziert (npm war gesperrt).
