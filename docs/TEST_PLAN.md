# TEST_PLAN

Befehl für alles: `npm test` (Unit + DB/RLS + Parität). Stand 24.10.2026: **43 Unit-Tests, 73 DB-Tests, 2 Paritätsprüfungen – alle grün.**

## Ebenen
| Ebene | Werkzeug | Ort |
|---|---|---|
| Unit (reine Logik) | `node:test` via `tsx` | `tests/unit/` |
| DB / RLS / Workflows | echtes Postgres 16 + Supabase-Stub, SQL-Assertions | `supabase/tests/`, `scripts/db-test.sh` |
| Parität TS ↔ SQL | Skript vergleicht Übergangstabellen | `scripts/check-transition-parity.ts` |
| Integration (OAuth, Resend, Webhooks, Upload-Links über HTTP) | Vitest/Playwright gegen Supabase lokal | offen |
| E2E (Onboarding, MFA, Kündigungsfreigabe, Nachweis-Upload, Aufgabe erledigen) | Playwright, iPhone-Viewport | offen |

## Abdeckung der Briefing-Anforderungen
| Anforderung | Test | Status |
|---|---|---|
| Transaktions-Dedup (auch zwei echte gleiche Käufe) | finance.test „Dubletten …" | ✅ |
| Umbuchungen erkennen | finance.test „Umbuchungen …" | ✅ |
| FX mit Datum/Quelle, keine Zukunftskurse, veraltet markiert | money_fx.test | ✅ |
| Tilgungsplan exakt, endet bei 0 | finance.test „Annuität …" | ✅ |
| Erinnerungen: Ruhezeiten, Limits, Stufen-Ende, Einwilligung, Pause/Snooze/Notaus, Sommerzeit | reminders_time.test | ✅ |
| Zustandsübergänge Aufgabe/Kündigung | state_machines.test + DB | ✅ |
| RLS Cross-User-Isolation, MFA-Pflicht, anon gesperrt | DB 1. | ✅ |
| Replay/Doppelversand | DB 3. | ✅ |
| Upload-Link Ablauf/Einmaligkeit | DB 4. | ✅ |
| Audit-Integrität (unveränderlich, Manipulation erkannt) | DB 5. | ✅ |
| Datenexport nur eigene Daten, Step-up | DB 6. | ✅ |
| Keine Seeds/Private Keys | DB 6. | ✅ |
| Demo-Kündigung „Büromietvertrag Mainz": leer bleibende Unbekannte, Freigabe, Step-up, simulierter Versand, Abschluss-Checkliste | DB 3. + Draft-Tests | ✅ Logik / ⏳ UI |
| Szenario 2 „Erinnere mich nächste Woche …" | priority_capture_draft.test | ✅ (Parser) |
| Szenario 8 „Ich bin überfordert" | priority_capture_draft.test | ✅ (Auswahl) |
| Szenario 11 doppelte Bankimporte | finance.test | ✅ |
| LTV-Plausibilität Immobilie | property.test | ✅ |
| Malware-Upload | DB (Gate) | ✅ Gate / ⏳ Scanner |
| Prompt-Injection (Szenario 9) | – | ⏳ P3 |
| CSRF/XSS/SSRF | – | ⏳ UI |
| OAuth-Widerruf (Szenario 10) | – | ⏳ P3 |
| Barrierefreiheit (Tastatur, Labels, 1–2 Taps) | – | ⏳ UI |
| 90-Tage-Simulation (P9) | – | ⏳ |
