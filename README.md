# Jarvis Sascha

Persönliches Betriebssystem für Sascha: Umzug Mainz → Dubai als erstes Projekt, danach dauerhafter „Chief of Staff" für Fristen, Rechnungen, Verträge, Dokumente und Alltag. Deutsch zuerst, mobil zuerst, **eine** nächste Handlung statt Listenflut. Jarvis bereitet vor – Sascha gibt frei.

> **Stand 25.10.2026:** Live unter https://jarvis-sascha.vercel.app (Vercel dub1 + Supabase EU). Saschas Konto mit Authenticator steht, Registrierung geschlossen. Neues Kommandobrücken-Design (PC: 3 Spalten mit Kern; iPhone: gestapelt) – siehe `docs/screens/0-bruecke-pc.png`.

## Schnellstart (lokal)
Voraussetzungen: Node ≥ 22, PostgreSQL 16.

```bash
npm install
# Postgres starten (einmalig initdb) – Beispiel mit Port 54322:
initdb -D ./.pgdata -U postgres --auth=trust
pg_ctl -D ./.pgdata -o "-p 54322 -k /tmp" -l ./.pgdata/log.txt start

npm run db:local              # legt jarvis_dev an (Migrationen + lokale Anmeldung)
cp .env.example .env.local    # AUTH_SECRET setzen: openssl rand -base64 48 ; ALLOW_SIGNUP=true
npm run build && npm start    # http://localhost:3000
```
Konto anlegen unter `/anmelden?neu=1`, dann den QR-Code mit der iPhone-App **Passwörter** (oder einer anderen Authenticator-App) scannen. Es gibt **kein** eingebautes Demo-Passwort; Beispieldaten wählst du in der Einrichtung („Mit Beispielen“) – alle als BEISPIEL markiert.

### Tests
```bash
npm run test:unit     # 46 Logik-Tests (inkl. TOTP nach RFC 6238)
npm run test:db       # 73 Tests gegen echtes Postgres (RLS, MFA, Freigaben, Audit …)
npm run test:parity   # Zustandsmaschinen TS == SQL
npm run test:e2e      # 2 Ende-zu-Ende-Abläufe im iPhone-Viewport (Playwright)
npm run typecheck
```

### Wie die App die Datenbank nutzt
Jede Anfrage läuft als Rolle `authenticated` mit den Claims des Nutzers (`aal2` nach Authenticator-Code) – genau wie Supabase/PostgREST. Dadurch greifen RLS, MFA-Pflicht und alle Guards aus `supabase/migrations/` auch dann, wenn Servercode fehlerhaft wäre. Die lokale Anmeldung (`supabase/local/`, `src/server/auth.ts`) ersetzt Supabase Auth nur, bis ein Supabase-Projekt existiert.

## Feature-Matrix
Legende: **TESTED** = gebaut und automatisch getestet · **IMPLEMENTED** = gebaut, ohne automatischen Test · **MOCKED** = Vorlage/Simulation · **BLOCKED** = wartet auf Zugang/Abhängigkeit · **PLANNED** = noch nicht begonnen

| Bereich | Funktion | Status |
|---|---|---|
| Sicherheit | RLS Cross-User-Isolation, MFA-Pflicht (aal2) auf allen Tabellen | TESTED |
| Sicherheit | Step-up (MFA ≤ 10 Min.) für Freigabe, Export, Löschung | TESTED |
| Sicherheit | Audit-Log append-only mit Hash-Kette, Manipulationserkennung | TESTED |
| Sicherheit | Upload-Links: gehasht, ≤ 7 Tage, einmalig, nur serverseitig einlösbar | TESTED |
| Sicherheit | Schutz gegen Seeds/Private Keys in Wallet-Feldern | TESTED |
| Sicherheit | Login + TOTP-Einrichtung per QR, Code-Pflicht, Replay-Schutz, Sperre nach 5 Fehlversuchen (lokal) | TESTED (Unit + E2E) |
| Sicherheit | Supabase Auth (E-Mail-Bestätigung, TOTP-Faktor, aal2, Step-up über amr) | IMPLEMENTED – erster Live-Test bei Saschas Registrierung |
| Datenbank | Supabase-Projekt (EU, eu-west-1): Migrationen 0001–0007, Live-Rauchtest RLS/MFA, Security Advisor ohne Befund | TESTED (live) |
| Sicherheit | Passkeys | PLANNED |
| Sicherheit | Sicherheits-Header (CSP, frame-ancestors, nosniff) | IMPLEMENTED |
| Sicherheit | Virenscan | MOCKED (Entwicklungs-Scanner: EICAR + aktive PDF-Inhalte; E2E-getestet) – echter Scanner PLANNED |
| Aufgaben | Zustandsmaschine V2, Nachweispflicht, Abhängigkeiten ohne Zyklen | TESTED |
| Aufgaben | Prioritäts-Engine mit Begründung, Heute-Ansicht (1 + 2), „überfordert"-Modus | TESTED (Logik) |
| Aufgaben | Schnellerfassung Deutsch („nächste Woche die Bank anrufen") | TESTED (Logik) |
| Aufgaben | Heute-Screen (1 + 2), Detailansicht (WAS/WARUM/BIS WANN/SCHRITT/NACHWEIS/VERLAUF), Später, Prio-Override, „Zu viel?“-Modus, Bottom-Nav | TESTED (E2E) |
| Aufgaben | Einrichtung in 4 Mini-Schritten mit Fortschritt | TESTED (E2E) |
| Oberfläche | Kommandobrücke (HUD): Kern mit Kennzahlen, Panels Heute/Aufgaben/Im Kopf/Geld/Dubai/Verträge/System, Wochenleiste, Lagebericht, DXB/DE-Uhr, Wetter (Open-Meteo), EUR→AED (EZB × Bindung 3,6725) | TESTED (E2E, iPhone + PC-Screenshot) |
| Aufgaben | Eingang: Prüfschlange für erkannte Aufgaben | IMPLEMENTED |
| Assistent | Feste Fragen („Was muss ich heute machen?“, „Was vergesse ich?“) aus eigenen Daten | IMPLEMENTED |
| Dokumente | Schema, Ordner, Zustände, Versionen, Dubletten-Hash, MIME-Allowlist | TESTED |
| Dokumente | Upload, Typprüfung an Dateibytes, Dubletten-Hinweis, Ordner, Suche, Download nur nach RLS + Scan | TESTED (E2E, lokale Ablage) |
| Dokumente | Privater Supabase-Bucket `vault` mit 60-s-Links | IMPLEMENTED (Bucket + Policies live angelegt) |
| Kündigungen | Pipeline mit hashgebundener Freigabe, Doppelversandschutz, Abschluss-Checkliste | TESTED |
| Kündigungen | Demo „Büromietvertrag Mainz": leere Unbekannte, Entwurf, Prüfpunkte, Häkchen, Step-up, Vorschau, Senden (simuliert), Beleg, Zugang, Bestätigung, Abschluss-Checkliste | TESTED (DB + E2E) |
| Kündigungen | Echter Vorgang: Brief zum Drucken, selbst verschickt, Versand verbuchen, Folgeaufgabe Auslieferungsbeleg | IMPLEMENTED |
| Kündigungen | Deutscher Entwurf ohne erfundene Daten, Prüfpunkte aus Recherche (Schriftform, Zugang, Befristung, Lager) | TESTED |
| Kündigungen | Automatischer Versand durch Jarvis (E-Mail) | PLANNED (P4) |
| Erinnerungen | Planer: Ruhezeiten, Tageslimit, Abstand, Stufen, Einwilligung, Pause, Snooze, Notaus, Sommerzeit | TESTED |
| Erinnerungen | Pause/Notaus/Ruhezeiten/Kanal-Einwilligung in den Einstellungen | IMPLEMENTED |
| Erinnerungen | Worker + E-Mail via Resend | BLOCKED (Resend-Konto) |
| Erinnerungen | Push, SMS, Anruf | PLANNED |
| Finanzen | Beträge/Rundung exakt (BigInt), FX mit Datum/Quelle | TESTED |
| Finanzen | CSV-Import (generisch DE), Dubletten über Importe, Umbuchungen, Abo-Erkennung | TESTED (mit synthetischen Dateien) |
| Finanzen | Bank-spezifische Profile mit echten Exporten | MOCKED (Vorlage `generic_de`, unverifiziert) |
| Finanzen | Liquiditätsprognose 3 Szenarien, Tilgungsplan | TESTED |
| Finanzen | Krypto-Börsen-Adapter | PLANNED |
| Immobilie | Schema mit Gewissheit je Angabe, LTV-Plausibilität (CBUAE) | TESTED |
| Immobilie | Dubai-Seite: Angaben mit „vermutet“, LTV-Warnung mit Quelle, Foto-Platzhalter, Unterlagen-Liste | IMPLEMENTED |
| Datenschutz | Export eigener Daten (Step-up), Löschanfrage mit Karenz | TESTED (DB) / IMPLEMENTED (UI) |
| Inbox | Gmail/Outlook OAuth, Triage, Prompt-Injection-Schutz | PLANNED (P3) |
| Umzug | Recherche DE/UAE mit Quellen und 22 App-Regeln | IMPLEMENTED (Dokument) |
| Umzug | Checkliste/Abhängigkeitsvorlagen in der App | PLANNED |
| Assistent | Chat mit Claude im Jarvis-Reiter (Kontext = eigene Daten, Vorschläge nur in den Eingang, Einwilligung `ai.claude`) | TESTED (E2E mit Claude-Testmodus) – live, sobald ANTHROPIC_API_KEY gesetzt |
| Dokumente | „Hochladen & sortieren“: Claude liest PDF/Foto, benennt, wählt Ordner, Absender/Betrag/Ablaufdatum, Aufgaben als „erkannt“ in den Eingang; ohne Schlüssel Einordnung nach Dateiname | TESTED (E2E mit Claude-Testmodus) |

## Dokumentation
`docs/PLAN.md` · `docs/ARCHITECTURE.md` · `docs/SECURITY.md` · `docs/DATA_MODEL.md` · `docs/TEST_PLAN.md` · `docs/ACCESS_CHECKLIST.md` · `docs/TASKS.md` · `docs/RESEARCH_DE_UAE.md`

## Grenzen (ehrlich)
- Keine Rechts- oder Steuerberatung. Recherche-Regeln sind als Prüfpunkte umgesetzt und tragen Quelle + Abrufdatum.
- Bank-CSV-Profile sind erst nach Test mit echten Exporten verlässlich.
- Tilgungsplan ist eine Prognose; verbindlich ist der Plan der Bank.
- Lokale Anmeldung ist für Entwicklung/Demo gedacht; für den Echtbetrieb wird sie durch Supabase Auth ersetzt.
- Der Virenscan ist ein Platzhalter.
