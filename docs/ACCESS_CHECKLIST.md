# ACCESS_CHECKLIST – was Sascha anlegen muss (Schritt für Schritt)

Grundsatz: **Du** besitzt alle Konten. Schlüssel kommen nur in den Secret-Store des Hostings bzw. in `.env.local` auf deinem Rechner – **nie** in einen Chat, eine E-Mail oder ein GitHub-Issue.

## Sofort (blockiert gerade den Bau)
- [ ] **Netzwerkzugriff für Paketmanager freischalten** – claude.ai im Browser → Einstellungen → Capabilities → npm/PyPI erlauben. Danach kann die Oberfläche gebaut und getestet werden.
- [ ] **GitHub-Konto** (kostenlos) → in claude.ai unter Einstellungen → Connectors mit GitHub verbinden. Dann lege ich das private Repo `jarvis-sascha` an und pushe.

## Für den ersten echten Start (P0/P1)
- [ ] **Supabase-Projekt** – Region **EU (Frankfurt)** wählen. Auth → MFA (TOTP) aktivieren. Werte: Projekt-URL, anon-Key, service-role-Key → in Vercel-Secrets.
- [ ] **Vercel-Konto** – mit GitHub verbinden, Projekt aus Repo importieren, drei Umgebungen (dev/preview/prod).
- [ ] **Authenticator-App** auf dem iPhone (z. B. die eingebaute Passwörter-App oder eine TOTP-App).
- [ ] **Resend-Konto** + eigene Domain (Absender verifizieren). Nur für Erinnerungen an dich selbst.
- [ ] **Test-E-Mail-Adresse** für Benachrichtigungen.

## Später (erst wenn das jeweilige Modul gebaut wird)
- [ ] Anthropic-API-Konto (P3: Klassifikation, Entwürfe) – mit Ausgabenlimit.
- [ ] Gmail- oder Microsoft-365-OAuth-App (P3, zuerst nur Lesen). Google verlangt für sensible Scopes ggf. eine App-Verifizierung.
- [ ] Twilio o. ä. für SMS/Anruf (P4) – deutsche und UAE-Vorgaben zu Einwilligung/Anrufen vorher prüfen.
- [ ] Kalender-OAuth (P6).
- [ ] Rechtlich freigegebene Fotos deiner Einheit (P5) – sonst bleibt ein neutraler Platzhalter.
- [ ] Echte Unterlagen (Mietverträge, Kaufvertrag/SPA, Bankangebot) – nur über die App, nach deiner Zustimmung.
- [ ] Fachleute: Steuerberater (Wegzug), ggf. Anwalt (Büro/Lager), internationale Spedition (Zoll), Mortgage-Berater (LTV).

## Kosten
Noch **nicht recherchiert** – das Briefing verlangt Preise erst nach Prüfung der aktuellen Anbieterseiten. Folgt vor dem ersten Deployment (Free-Tier-Grenzen vs. Produktionskosten getrennt).
