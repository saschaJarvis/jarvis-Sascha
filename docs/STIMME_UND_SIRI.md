# Stimme (ElevenLabs) und Siri-Kurzbefehl

## 1. ElevenLabs verbinden (ca. 5 Minuten)
1. Auf **elevenlabs.io** ein Konto anlegen und den Plan **Starter** wählen (der kostenlose Plan hat keine API).
2. In ElevenLabs: Profil (unten links) → **API Keys** → **Create API Key**. Name: `Jarvis`.
   Rechte: **Text to Speech: Access**, **Voices: Read**, **User: Read** (für die Guthaben-Anzeige) – alles andere aus.
3. Schlüssel kopieren (beginnt mit `sk_`). Nicht in Chats einfügen.
4. **vercel.com** → Projekt `jarvis-sascha` → **Settings** → **Environment Variables** → **Add**:
   Name `ELEVENLABS_API_KEY`, Wert = Schlüssel, Umgebung **Production** → **Save**.
5. **Deployments** → oberstes Deployment → **⋯** → **Redeploy** (neue Schlüssel gelten erst nach einem neuen Deployment).

## 2. Stimme wählen
Jarvis → **Leben → Einstellungen → Stimme & Siri**: Stimme auswählen, **▶ Probehören**, Tempo und Qualität einstellen, **Speichern**.
- **Schnell**: antwortet flott, verbraucht etwa das halbe Guthaben.
- **Beste Qualität**: natürlicher, etwas langsamer.
- Mehr Stimmen: in ElevenLabs → **Voices → Voice Library**, Filter Sprache **Deutsch**, Stimme **Add to My Voices** – sie erscheint danach in Jarvis unter „Meine Stimmen“.
- Ist das Guthaben leer oder ElevenLabs nicht erreichbar, liest automatisch die iPhone-Stimme.

## 3. Siri-Kurzbefehl „Jarvis“
1. Jarvis → Einstellungen → **Stimme & Siri** → **Neuen Siri-Schlüssel erstellen** (fragt evtl. nach dem Authenticator-Code). Schlüssel kopieren – er wird nur einmal angezeigt.
2. App **Kurzbefehle** → **+** → oben Namen tippen: **Jarvis**.
3. Aktion **„Text diktieren“** hinzufügen (Sprache: Deutsch, Diktat beenden: *Nach Pause*).
4. Aktion **„Inhalte von URL abrufen“**:
   - URL: die **Adresse für den Kurzbefehl** aus den Jarvis-Einstellungen (Tippen kopiert sie)
   - Pfeil aufklappen → Methode **POST**
   - Header: Schlüssel `Authorization`, Wert `Bearer ` + dein Schlüssel (mit Leerzeichen nach Bearer)
   - Anfragetext **JSON**: Feld `frage` (Text) = Variable **Diktierter Text**
5. Antwort abspielen:
   - **Mit ElevenLabs-Stimme** (Adresse endet auf `?stimme=1`): Aktion **„Ton abspielen“** (engl. *Play Sound*) mit **Inhalte von URL**.
   - **Mit Siri-Stimme** (Adresse ohne `?stimme=1`): **„Wörterbuchwert abrufen“** – Schlüssel `antwort` – danach **„Text sprechen“**.
6. Fertig: **„Hey Siri, Jarvis“**. Auf iPhones mit Aktionstaste: Einstellungen → Aktionstaste → Kurzbefehl → Jarvis.

Sicherheit: Der Schlüssel erlaubt nur Fragen an Jarvis (kein Export, keine Freigaben, kein Löschen) und wird nur als Hash gespeichert. Verlorenes iPhone → Schlüssel in den Einstellungen **sperren**.
Bleibt Siri nach der Frage stumm, ist meist das ElevenLabs-Guthaben leer – dann Schritt 5 auf die Siri-Stimme umstellen.
