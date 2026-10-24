# ARCHITECTURE – Jarvis Sascha

## Überblick
```
iPhone (PWA, Next.js App Router, Deutsch)
   │  HTTPS, Supabase-Session (JWT mit aal2 nach TOTP/Passkey)
   ▼
Next.js Server (Vercel)  ── Server Actions / Route Handlers
   │   • liest/schreibt mit Nutzer-JWT  → Postgres prüft RLS
   │   • privilegierte Schritte (Upload-Link einlösen, Versand) nur serverseitig mit service_role
   ▼
Supabase
   • Postgres: Tabellen + RLS + Guards (Trigger) = letzte Instanz für Regeln
   • Auth: E-Mail + TOTP (MFA Pflicht), später Passkeys
   • Storage: privater Bucket „vault", Pfad <user_id>/…, signierte URLs mit kurzer Laufzeit
   • Cron / Edge Functions: Erinnerungs-Worker, Virenscan-Worker, Lösch-Worker
   ▼
Externe Dienste (nur nach Einwilligung, einzeln freigeschaltet)
   Resend (E-Mail) · Twilio (SMS/Voice, später) · Gmail/Graph OAuth (read-only zuerst) · Anthropic (Entwürfe/Klassifikation)
```

## Leitprinzip: „Modell schlägt vor, Anwendung erzwingt"
| Schicht | Aufgabe | Ort |
|---|---|---|
| Deterministische Domänenlogik | Geld, FX, Tilgung, Prognose, Dedup, Fristen, Erinnerungen, Prioritäten, Zustandsmaschinen | `src/lib/domain/*` (rein, ohne I/O, voll unit-getestet) |
| Datenbank-Guards | Statuswechsel, Nachweis-/Abhängigkeitsregeln, Freigabe-Bindung, Doppelversand, Audit-Kette, Mandantentrennung | `supabase/migrations/*` (SQL-getestet) |
| KI (später) | Klassifizieren, Felder vorschlagen, Entwürfe formulieren – Ergebnis immer `certainty = inferred` bis bestätigt | Server, mit Datenminimierung |

Die Zustandsmaschinen existieren doppelt (TS für die UI, SQL für die Durchsetzung). `scripts/check-transition-parity.ts` bricht den Build, wenn sie auseinanderlaufen.

## Gewissheit jeder Angabe
`detected` (Parser/Import) · `inferred` (Heuristik/KI/Selbstauskunft ohne Beleg) · `verified` (vom Nutzer bestätigt oder durch Dokument belegt). Die UI zeigt das sichtbar an; Fristen mit `inferred` erzeugen keine harten Eskalationen.

## Kündigungs-Pipeline (Kern der „Freigabe vor Handlung")
```
DETECTED → TERMS_REVIEW → DRAFT → USER_REVIEW → APPROVED → SENT → DELIVERY_EVIDENCE → CONFIRMED → CLOSED
                                   ↑   (jede Entwurfsänderung → zurück zu DRAFT)
Nebenpfade: BLOCKED · ERROR · DISPUTED
```
- `APPROVED` nur über `app.approve_cancellation()`: verlangt `aal2`, MFA ≤ 10 Min. alt, den erwarteten SHA-256 des Entwurfs und einen Bestätigungstext. Freigaben sind unveränderlich.
- `SENT` nur mit Ausgangsnachricht `dispatched` und identischem Hash; Demo-Vorgänge erzeugen ausschließlich `mode = simulated` – die DB verbietet `real` für Demos.
- Doppelversand: eindeutiger Index (max. eine echte, nicht fehlgeschlagene Nachricht pro Kündigung) + Idempotenzschlüssel.
- `CLOSED` nur mit vollständiger Abschluss-Checkliste (Schlussrechnung, Kaution, Schlüssel …).

## Aufgaben-Zustandsmaschine (V2)
`DETECTED → NEEDS_REVIEW → READY → IN_PROGRESS → WAITING_FOR_USER/THIRD_PARTY → EVIDENCE_PENDING → VERIFIED → CLOSED` + `BLOCKED, DISPUTED, CANCELLED`. Wiederöffnen (`CLOSED/CANCELLED → READY`) ist erlaubt, Historie bleibt im Audit-Log.

## Erinnerungen
`planNextReminder()` entscheidet deterministisch `send | wait | stop`:
Ruhezeiten (lokal, über Mitternacht, sommerzeitfest) · Tageslimit · Mindestabstand · Pause · Snooze · Notaus · Einwilligung pro Kanal · feste Stufenleiter (App → Push/E-Mail → „klarer nächster Schritt" → „gemeinsam machen?" → bei *kritisch + Einwilligung* Anruf → Ende mit Angebot zur Übergabe). Keine Endlosschleifen, keine Dritten.

## Jobs (geplant, P1/P4)
Durable Jobs über Postgres-Tabellen (`reminders`, `outbound_messages`) mit Idempotenzschlüssel, Retry mit Backoff, Dead-Letter = `status failed` + Audit. Missed-Run-Recovery: Worker verarbeitet alle fälligen `scheduled_for <= now()`.

## Verzeichnisstruktur
```
src/lib/domain/       reine Logik (money, fx, time, reminders, priority, taskStateMachine,
                      cancellationStateMachine, cancellationDraft, transactions, amortization,
                      forecast, quickCapture)
src/lib/import/       CSV-Parser, Kontoauszug-Adapter
supabase/migrations/  Schema, RLS, Guards, Funktionen
supabase/tests/       lokaler Supabase-Stub + SQL-Tests
tests/unit/           node:test-Tests
scripts/              db-test.sh, Paritätsprüfung
seed/                 fiktive Demo-Daten
docs/                 diese Dokumente
```
(Next.js-`app/` folgt, sobald npm verfügbar ist.)
