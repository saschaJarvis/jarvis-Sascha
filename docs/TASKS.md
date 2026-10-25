# TASKS (Entwicklung)

## Erledigt – 24.10.2026
- [x] Planungsdokumente (PLAN, ARCHITECTURE, SECURITY, DATA_MODEL, TEST_PLAN, ACCESS_CHECKLIST, TASKS)
- [x] Recherche DE/UAE mit Quellen (`RESEARCH_DE_UAE.md`, 22 App-Regeln)
- [x] Migrationen 0001–0005: Kern, Aufgaben/Dokumente, Verträge/Kündigung/Benachrichtigung, Finanzen/Immobilie, Datenschutz/Storage
- [x] RLS + MFA-Pflicht + Guards + Audit-Kette – 73 DB-Tests
- [x] Domänenlogik: Geld, FX, Zeit/Zeitzonen, Erinnerungen, Priorität/Heute, Zustandsmaschinen, Kündigungsentwurf, Dedup/Transfers/Abos, Tilgung, Prognose, Schnellerfassung, LTV – 43 Unit-Tests
- [x] Paritätsprüfung TS ↔ SQL, CI-Workflow, `.env.example`, Demo-Seed

## Erledigt – 24.10.2026 (Abend)
- [x] npm freigeschaltet, GitHub-Repo `saschaJarvis/jarvis-sascha` verbunden
- [x] Next.js-App: Anmeldung + TOTP-Pflicht, Einrichtung, Heute, Aufgaben, Eingang, Leben, Jarvis, Dokumente, Verträge/Kündigung, Dubai, Einstellungen, Export
- [x] Playwright-E2E (2 Abläufe, iPhone-Viewport) + Bildschirmfotos in docs/screens

## Als Nächstes
- [x] Supabase-Projekt angelegt, Migrationen 0001–0007 live, Supabase Auth + Storage angebunden
- [x] Vercel-Projekt live (Supabase-Integration), Saschas Konto + Authenticator, Registrierung in der App geschlossen
- [ ] (Sascha) In Supabase „Allow new users to sign up“ ausschalten
- [x] Kommandobrücken-Design (25.10.)
- [ ] Claude im Jarvis-Reiter (wartet auf ANTHROPIC_API_KEY in Vercel)
- [ ] Erinnerungs-Worker (Cron) + Resend (nur an dich selbst)
- [ ] Finanz-Cockpit-Ansicht + Kontoauszug-Import in der App
- [ ] Echter Virenscanner (ClamAV-Worker)
- [ ] Passkeys, CSP mit Nonces
- [ ] Kündigungs-Fristrechner Wohnraum (§ 573c, Regel R2) – erst nach Gegenprüfung der Werktagsregel
- [ ] Wegzugs-Abhängigkeiten als Vorlage (R13: Steuerberater → Abmeldung; KV UAE → KV DE Ende; Visum → Container)

## Hinweise für Sascha (aus der Recherche, ohne Gewähr – bitte fachlich bestätigen lassen)
- Wohnung ist übergeben (kein Off-Plan, laut Sascha 25.10.2026): geplante ~60 % Finanzierung liegt unter der CBUAE-Grenze für fertige Objekte (Expat, erste Immobilie: 80 % unter AED 5 Mio.). Verbindlich nur das Bankangebot. Title Deed hochladen.
- Einwurf-Einschreiben: Online-Status beweist den Zugang nicht – Auslieferungsbeleg anfordern.
- Steuerberater **vor** Abmeldung/Gewerbeabmeldung.
