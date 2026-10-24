# DEPLOYMENT – Jarvis online stellen (Vercel + Supabase)

Stand 24.10.2026. Supabase-Projekt: **saschaJarvis's Project** (`whoktjpduwymtgbrvrxe`, Region eu-west-1 / Irland).

## Bereits erledigt (durch Claude über den Supabase-Connector)
- Migrationen 0001–0007 eingespielt (Tabellen, RLS, MFA-Pflicht, Freigabe-Regeln, Audit-Kette, privater Bucket `vault`, Profil-Trigger, Härtung).
- Live-Rauchtest in einer zurückgerollten Transaktion: fremde Daten unsichtbar, ohne Authenticator (aal1) nichts lesbar, `anon` gesperrt, ungültige Statuswechsel blockiert, Audit-Kette intakt.
- Supabase Security Advisor: **keine Befunde**.
- Öffentliche Werte (Projekt-URL, Publishable Key) stehen in `.env.production`.

## Was Sascha einmal tun muss (ca. 10 Minuten, geht am iPhone)

### 1. Datenbank-Adresse kopieren (geheim!)
Supabase → Projekt öffnen → oben **Connect** → Reiter **Transaction pooler** → URI kopieren.
`[YOUR-PASSWORD]` durch das Datenbank-Passwort ersetzen, das du beim Anlegen vergeben hast.
(Vergessen? Project Settings → Database → **Reset database password**.)
👉 Diese Adresse **nirgends** posten – nur im nächsten Schritt bei Vercel einfügen.

### 2. Vercel-Projekt anlegen
1. vercel.com → **Sign up / Log in with GitHub**.
2. **Add New… → Project** → Repository `jarvis-sascha` → **Import**.
3. Vor dem Klick auf Deploy: **Environment Variables** aufklappen:
   - Name `DATABASE_URL`, Wert = die Adresse aus Schritt 1.
4. **Deploy**. Nach ca. 1–2 Minuten bekommst du eine Adresse wie `jarvis-sascha-xyz.vercel.app`.

### 3. Supabase die App-Adresse mitteilen
Supabase → **Authentication → URL Configuration**:
- **Site URL** = `https://<deine-vercel-adresse>`
- **Redirect URLs** → Add URL: `https://<deine-vercel-adresse>/**`

### 4. Konto anlegen
App öffnen → „Neues Konto anlegen“ → Bestätigungs-E-Mail öffnen → Authenticator einrichten → Einrichtung.
Tipp: App in Safari öffnen → Teilen → **Zum Home-Bildschirm**.

### 5. Registrierung schließen (sobald dein Konto steht)
Sag Claude Bescheid – dann wird `ALLOW_SIGNUP=false` gesetzt und in Supabase die Neuregistrierung abgeschaltet.

## Technik
| Variable | Wo | Geheim? |
|---|---|---|
| `AUTH_PROVIDER=supabase` | `.env.production` | nein |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.production` | nein |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Publishable Key) | `.env.production` | nein (durch RLS geschützt) |
| `DATABASE_URL` (Transaction Pooler, Port 6543) | Vercel Environment Variables | **ja** |
| `SUPABASE_DB_CA` (optional, PEM der Supabase-CA für strikte Zertifikatsprüfung) | Vercel | nein |

Der Server verbindet sich mit `DATABASE_URL`, setzt pro Anfrage `role authenticated` + die geprüften JWT-Claims des Nutzers – RLS und alle Guards gelten genauso wie in den Tests. Dateien liegen im privaten Bucket `vault`; Downloads nur über 60-Sekunden-Links nach RLS-Prüfung. Uploads sind auf Vercel auf 4 MB begrenzt (Plattformgrenze); größere Dateien folgen über direkte, signierte Uploads.

## Bekannte Grenzen
- Die Supabase-Anmeldung (E-Mail-Bestätigung, TOTP über Supabase) ist gebaut, konnte aber aus der Entwicklungsumgebung nicht gegen das echte Projekt getestet werden (Netzwerk gesperrt). Erster echter Test = deine Registrierung; Claude prüft dabei die Logs über den Connector.
- Virenscan ist weiterhin der Entwicklungs-Platzhalter.
