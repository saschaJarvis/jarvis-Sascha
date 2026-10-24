# PLAN – Jarvis Sascha

Stand: 24.10.2026 · Grundlage: `JARVIS_SASCHA_CLAUDE_BUILD.md` (Briefing V1 + V2, beide verbindlich)

## Ziel in einem Satz
Ein ruhiges, deutschsprachiges, mobiles „Chief of Staff"-System, das Sascha jeden Tag **eine** nächste Handlung zeigt, Fristen und Zahlungen sichtbar hält, Entwürfe vorbereitet – und nie ohne seine ausdrückliche, abgesicherte Freigabe nach außen handelt.

## Entscheidungen (von Sascha am 24.10.2026 bestätigt)
| Thema | Entscheidung |
|---|---|
| Code-Ort | Neues GitHub-Repo (noch nicht verbunden – Projekt liegt bis dahin als ZIP vor) |
| Stack | wie Briefing: Next.js + TypeScript + Tailwind, Supabase (Postgres, Auth mit MFA, RLS, privater Storage), Vercel |
| Start | P0 + P1 |
| Konten | noch keine – lokal bauen, Checkliste liefern (`ACCESS_CHECKLIST.md`) |

## Phasen
| Phase | Inhalt | Status |
|---|---|---|
| **P0** | Architektur, Threat Model, Repo, MFA-Auth, DB/RLS, UI-Shell, Audit-Log | DB/RLS/Audit **fertig + getestet**; UI-Shell & Auth-Flows **blockiert (npm)** |
| **P1** | Onboarding, manuelle Aufgaben, Dokument-Upload, Nachweis-Workflow, E-Mail-Benachrichtigung | Schema + Logik **fertig + getestet**; UI/Resend **blockiert** |
| P2 | Kontoauszug-Importe, Finanz-Cockpit, wiederkehrende Kosten, Prognose, Krypto-Importe | Kernlogik (Import, Dedup, Transfers, FX, Prognose, Tilgung) **vorgezogen + getestet** |
| P3 | Gmail/Outlook read-only OAuth, Inbox-Triage, Abo-Erkennung, Entwurfsgenerator | Entwurfsgenerator **getestet**; OAuth offen |
| P4 | Freigegebener Versand, Kündigungs-Workflow, SMS/Voice, Eskalation | Workflow-Regeln in DB **getestet**; Eskalationsplaner **getestet**; Versand offen |
| P5 | Wissensbasis DE/UAE (offizielle Quellen), Versand/Container, Immobilie, Politur | Recherche begonnen (`RESEARCH_DE_UAE.md`) |
| P6–P9 | Universal Capture, Wissensgraph, Briefing, Haushalt/Reisen/Fahrzeug, Delegation, Voice, 90-Tage-Simulation, Audit | geplant; Schnellerfassung (DE) vorgezogen |

## Nächste Meilensteine (in dieser Reihenfolge)
1. **npm freischalten** → Next.js-App-Shell: Login mit Supabase Auth + TOTP-Pflicht, Bottom-Nav (Heute · Inbox · Leben · Jarvis).
2. **Heute-Screen** auf `buildTodayView` (eine Hauptaktion + 2 dringende, mit „Warum?").
3. **Aufgabe-Detail** (WAS / WARUM / BIS WANN / VORBEREITET / EINE AKTION / NACHWEIS / VERLAUF) + Nachweis-Upload über privaten Bucket.
4. **Demo-Kündigung „Büromietvertrag Mainz"** als UI (Akzeptanztest aus dem Briefing) auf den bereits getesteten DB-Funktionen.
5. **Onboarding-Wizard** (Mini-Schritte, Fortschritt in %).
6. **Erinnerungs-Worker** (Supabase Cron/Edge Function) + Resend nur an Sascha selbst.
7. Playwright-E2E: Onboarding, MFA, Kündigungsfreigabe, Nachweis-Upload, Aufgabe erledigen.

## Qualitäts-Gates (vor jedem Deployment)
- `npm test` grün (Unit, DB/RLS, Paritätsprüfung), Typecheck grün.
- Feature-Matrix im README aktualisiert – nichts als fertig markiert, was nicht getestet ist.
- Kein echter externer Versand ohne: Freigabe an Entwurfs-Hash + Step-up + Idempotenzschlüssel + Audit.
