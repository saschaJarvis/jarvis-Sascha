# Recherche: Umzug Mainz -> Dubai (Wegzug DE / Zuzug UAE)

Stand der Recherche: **2026-10-24**. Alle Links mit Abrufdatum 2026-10-24, sofern nicht anders vermerkt.
Zweck: Fachgrundlage für die Personal-Admin-App (Jarvis). **Keine Rechts- oder Steuerberatung.**
Legende:
- **[primär]** = Gesetzestext / Behörde / Gericht; **[sekundär]** = Kanzlei, Verband, Presse, Makler.
- **bedingt** = gilt nur, wenn die genannte Bedingung erfüllt ist. Die App muss die Bedingung abfragen.
- **nicht verifiziert** = Seite nicht erreichbar oder Aussage nicht aus Primärquelle bestätigt.
- Über die konkrete Wohnung in Dubai Islands (Imtiaz) werden hier **keine** Aussagen gemacht.

---

## 1. Kündigungen in Deutschland

### 1.1 Wohnraummiete (Wohnung Mainz)
**Was gilt**
- Form: § 568 Abs. 1 BGB: „Die Kündigung des Mietverhältnisses bedarf der schriftlichen Form.“ [primär]
  - Schriftform heißt: Papier mit eigenhändiger Unterschrift (§ 126 BGB). **E-Mail, Fax, WhatsApp und Scan sind nicht wirksam.**
  - Ob man die Schriftform durch die elektronische Form mit qualifizierter elektronischer Signatur ersetzen kann (§ 126 Abs. 3, § 126a BGB), ist **nicht verifiziert** (§ 126 war nicht abrufbar). Die App soll sich darauf nicht stützen.
- Frist für den Mieter: § 573c Abs. 1 BGB. Die Kündigung muss „spätestens am dritten Werktag eines Kalendermonats zum Ablauf des übernächsten Monats“ zugehen. Das sind faktisch knapp 3 Monate. [primär]
  - § 573c Abs. 4: Eine Vereinbarung, die zum Nachteil des Mieters von dieser Frist abweicht, ist unwirksam. Eine kürzere Frist ist also möglich, eine längere nicht.
  - Die verlängerten Fristen nach 5 bzw. 8 Jahren gelten **nur für den Vermieter**.
- Maßgeblich ist der **Zugang** beim Vermieter, nicht das Absendedatum. Wird „Werktag“ als Samstag gezählt? Das ist Rechtsprechungsfrage, **nicht verifiziert**. Die App soll konservativ rechnen: Samstag nicht als Werktag zählen und Puffer einplanen.

**bedingt**
- Zeitmietvertrag (§ 575 BGB) oder vereinbarter Kündigungsverzicht: Ordentlich kündbar erst zum Ende der Laufzeit bzw. des Verzichts. Die App muss den Vertrag prüfen lassen.
- Mehrere Mieter im Vertrag: Alle Mieter müssen unterschreiben. Er zieht zwar allein, aber die App fragt nach Mitmietern.

**Kein Sonderkündigungsrecht wegen Wegzug ins Ausland**
- Das BGB kennt kein Sonderkündigungsrecht bei Auswanderung oder Jobwechsel.
- Möglich sind nur eine Nachmieterklausel im Vertrag oder ein Aufhebungsvertrag mit dem Vermieter.

**App muss fragen/prüfen**
- Vertragsbeginn, befristet ja/nein, Kündigungsverzicht, Mitmieter.
- Exakte Vermieteranschrift (Hausverwaltung oder Eigentümer?) und Vollmacht der Verwaltung.
- Geplantes Auszugsdatum.
- Ablauf der Kaution, Übergabeprotokoll, Schönheitsreparaturklausel: nur als Hinweis „prüfen lassen“.

**Offen**
- Werktagsdefinition (Samstag).
- Wirksamkeit der qualifizierten elektronischen Signatur.

Quellen:
- https://www.gesetze-im-internet.de/bgb/__568.html [primär]
- https://www.gesetze-im-internet.de/bgb/__573c.html [primär]

### 1.2 Gewerberaum / Büro Mainz
**Was gilt**
- § 568 BGB (Schriftform) gilt **nicht** für Geschäftsräume. § 578 Abs. 2 BGB verweist nicht auf § 568 Abs. 1. Eine gesetzliche Form besteht also nicht, maßgeblich ist der Vertrag. [primär]
- In der Praxis enthalten fast alle Gewerbemietverträge Schriftformklauseln. Die App behandelt deshalb **Schriftform als Standard**.
- Gesetzliche Frist bei unbefristetem Vertrag (§ 580a Abs. 2 BGB): „spätestens am dritten Werktag eines Kalendervierteljahres zum Ablauf des nächsten Kalendervierteljahrs“. Das sind rund 6 Monate. [primär]
- Für Gewerbemietverträge mit mehr als einem Jahr Laufzeit verlangt § 578 Abs. 1 S. 2 BGB jetzt die **Textform** (dies betrifft den Vertragsschluss, nicht die Kündigung). Ein Verstoß führt dazu, dass der Vertrag als unbefristet gilt und damit nach § 580a kündbar ist. Ob diese Regel auf die Gesetzesänderung (BEG IV) zurückgeht und ab wann sie gilt, ist **nicht verifiziert**. [primär, Text]

**bedingt**
- Befristeter Gewerbemietvertrag mit fester Laufzeit: **nicht ordentlich kündbar** bis Laufzeitende. Ausnahme: Formmangel nach § 550/§ 578. Das muss ein Anwalt prüfen.
- Mieter ist die Firma (GmbH/UG): Unterschrift durch den Geschäftsführer in Vertretung. Mieter ist er persönlich (Einzelunternehmen): eigene Unterschrift.
- § 309 BGB (AGB-Klauselverbote) gilt gegenüber Unternehmern nicht direkt (§ 310 Abs. 1 BGB, nicht separat abgerufen).

**App muss fragen**
- Wer ist Vertragspartei (Person oder Gesellschaft)? Befristung? Optionen/Verlängerungsklauseln? Vertragliche Formklausel? Rückbaupflichten?

Quellen:
- https://www.gesetze-im-internet.de/bgb/__580a.html [primär]
- https://www.gesetze-im-internet.de/bgb/__578.html [primär]

### 1.3 Lagerraum / Self-Storage (Unsicherheit)
- Die Rechtsnatur hängt vom Vertrag ab:
  - Ein **Mietvertrag** liegt vor, wenn ein abgegrenzter Raum zur eigenen Nutzung überlassen wird. Das ist bei Self-Storage der Regelfall laut gesichteten AGB großer Anbieter [sekundär].
  - Ein **Verwahrungsvertrag** (§§ 688 ff. BGB) liegt vor, wenn der Anbieter die Sachen in Obhut nimmt, z. B. bei Möbellagerung durch eine Spedition.
- **bedingt** bei Miete und privater Nutzung: § 580a Abs. 1 BGB. Bei monatlicher Miete gilt dann „spätestens am dritten Werktag eines Kalendermonats zum Ablauf des übernächsten Monats“, sofern der Vertrag nichts anderes regelt. Bei geschäftlicher Nutzung (Büro- oder Firmenware) kommt eventuell § 580a Abs. 2 (Quartal) in Betracht. [primär]
- In der Praxis regeln die AGB meist kürzere Fristen und eine Mindestlaufzeit. Der Vertrag geht vor, soweit er wirksam ist.
- Ob § 309 Nr. 9 BGB (Laufzeitgrenzen) auf Mietverträge anwendbar ist, ist umstritten bzw. **nicht verifiziert**.
- Vor der Kündigung muss die Räumung organisiert sein, sonst laufen weitere Kosten.
- **Pfandrecht:** Ein Vermieterpfandrecht (§ 562 BGB, über § 578 anwendbar) oder ein AGB-Pfandrecht kann die Herausgabe blockieren, solange Rückstände bestehen.
- App fragt: Vertragstyp laut Vertragstext, Mieter (Person oder Firma), Mindestlaufzeit, Frist, Form, Räumungstermin.

Quelle: https://www.gesetze-im-internet.de/bgb/__580a.html [primär]. Beispiel-AGB (nur sekundär, nicht ausgewertet): https://static.shurgard.com/-/media/shurgard/corporate/germany/docs/terms-conditions/20260715-terms-conditions-de-de.pdf

### 1.4 Verbraucherverträge (Strom, Gas, Versicherungen, Abos, Fitness usw.)
- **§ 309 Nr. 13 BGB:** Eine AGB-Klausel, die für Kündigungen eine strengere Form als die **Textform** verlangt, ist unwirksam. Ausnahme: Verträge, die notariell beurkundet werden müssen. Textform heißt nach § 126b BGB: lesbare Erklärung, Person genannt, dauerhafter Datenträger. E-Mail genügt also. [primär]
- **§ 309 Nr. 9 BGB** (für Verträge mit regelmäßiger Lieferung oder Dienstleistung) [primär]:
  - Erstlaufzeit höchstens 2 Jahre.
  - Stillschweigende Verlängerung nur auf unbestimmte Zeit, danach jederzeit mit höchstens 1 Monat Frist kündbar.
  - Kündigungsfrist zum Ende der Erstlaufzeit höchstens 1 Monat.
  - Ausnahmen u. a.: Versicherungsverträge, als zusammengehörig verkaufte Sachen.
  - **bedingt:** Diese Grenzen gelten für Verträge nach der Neufassung durch das Gesetz für faire Verbraucherverträge. Das genaue Stichtagsdatum der Übergangsregel (Art. 229 EGBGB) ist **nicht verifiziert**. Altverträge können abweichen.
- **§ 312k BGB (Kündigungsbutton)** [primär]:
  - Gilt für entgeltliche Dauerschuldverhältnisse, die über eine Website abgeschlossen werden können. Ausgenommen sind Finanzdienstleistungen und Verträge mit gesetzlicher Form strenger als Textform.
  - Pflicht-Button „Verträge hier kündigen“, danach eine Bestätigungsseite mit „jetzt kündigen“.
  - Der Unternehmer muss die Kündigung unverzüglich in Textform bestätigen, mit Inhalt, Eingangszeitpunkt und Vertragsende (Abs. 4).
  - Fehlt der Button, kann der Verbraucher **jederzeit ohne Frist kündigen** (Abs. 6).
  - Ohne Angabe eines Datums gilt die Kündigung zum frühestmöglichen Zeitpunkt (Abs. 5).
- Versicherungen: Kein Wegfall des Risikos automatisch. Ein Kündigungsrecht wegen Wegzugs ist **bedingt** nach Versicherungsbedingungen bzw. VVG möglich und muss pro Vertrag geprüft werden. Siehe zur PKV Abschnitt 4.

**App muss**
- Pro Vertrag erfassen: Abschlussweg (online ja/nein → Button), Abschlussdatum, Erstlaufzeit, Verlängerungsmodus, Frist, Kündigungskanal.
- Bei Button-Kündigungen die Bestätigungsseite (Screenshot/PDF) und die Bestätigungs-E-Mail archivieren.
- Bei fehlender Bestätigung nach angemessener Zeit erinnern.

Quellen:
- https://www.gesetze-im-internet.de/bgb/__309.html [primär]
- https://www.gesetze-im-internet.de/bgb/__312k.html [primär]
- https://www.gesetze-im-internet.de/bgb/__126b.html [primär]

### 1.5 Telekommunikation (Festnetz/Internet/Mobilfunk)
- **§ 56 Abs. 1 TKG:** Erstlaufzeit bei Verbrauchern höchstens 24 Monate.
- **§ 56 Abs. 3 TKG:** Nach der Erstlaufzeit ist der Vertrag „jederzeit unter Einhaltung einer Kündigungsfrist von einem Monat“ kündbar, und zwar kostenfrei (Abs. 4). [primär]
- **§ 60 TKG (Umzug):** [primär]
  - Abs. 1: Der Anbieter muss die Leistung am neuen Wohnsitz weiter erbringen, wenn er sie dort anbietet.
  - Abs. 2: Bietet er sie am neuen Wohnsitz nicht an, kann der Verbraucher „unter Einhaltung einer Kündigungsfrist von einem Monat kündigen“. Die Kündigung kann zum Auszugsdatum oder später wirken.
  - **Umzug ins Ausland:** § 56 erwähnt ihn nicht. § 60 spricht allgemein vom „neuen Wohnsitz“. Dass ein deutscher Festnetz- oder Mobilfunkanbieter in Dubai keine Leistung anbietet, ist naheliegend. Die Anwendung von § 60 Abs. 2 auf den Auslandswegzug ist aber **nicht ausdrücklich im Gesetz geregelt und nicht verifiziert**. Als Nachweis die Abmeldebestätigung (Abschnitt 2) beifügen.
- **bedingt:** § 60 schützt **Verbraucher**. Für Firmenanschlüsse (Büro) gilt grundsätzlich der Vertrag. Ob die TKG-Kundenschutzrechte für Kleinstunternehmen erweitert gelten (§ 71 TKG), ist **nicht verifiziert**.
- Form: Das TKG schreibt keine Form vor. Gilt § 309 Nr. 13, reicht Textform. Bei Online-Abschluss gibt es den Button nach § 312k.
- § 56 Abs. 5: Bei Mail-Adressen des Providers muss der Anbieter für eine angemessene Zeit nach Vertragsende den Zugriff bzw. eine Weiterleitung ermöglichen. **Wichtig für die Adressmigration.**
- Rufnummern: Ob die Nummer bei Kündigung portiert werden soll, z. B. für die 2FA bei Banken, muss **vor** der Kündigung entschieden werden.

Quellen:
- https://www.gesetze-im-internet.de/tkg_2021/__56.html [primär]
- https://www.gesetze-im-internet.de/tkg_2021/__60.html [primär]

### 1.6 Zugangsnachweis (alle Kündigungen)
- Wirksam wird die Kündigung mit dem **Zugang**. Der Absender trägt die Beweislast.
- **Einwurf-Einschreiben:** Laut BAG, Urt. v. 30.01.2025 – 2 AZR 68/24, begründen Einlieferungsbeleg und Online-Sendungsstatus **keinen Anscheinsbeweis** für den Zugang: „Der Sendungsstatus ist kein Ersatz für den Auslieferungsbeleg.“ Der Auslieferungsbeleg kann bei der Deutschen Post angefordert werden (laut Urteil 15 Monate aufbewahrt). [primär] → Die App muss den Auslieferungsbeleg zeitnah anfordern und speichern.
- **Übergabe-Einschreiben:** Wird es nicht abgeholt, fehlt in der Regel der Zugang (allgemeine Praxis, hier nicht gesondert verifiziert). Für fristkritische Kündigungen ist es deshalb ungeeignet.
- **Bote:** Ein Zeuge liest das Schreiben, kuvertiert es, wirft es selbst ein und protokolliert Datum, Uhrzeit und Briefkasten. Das gilt in der Praxis als stärkster einfacher Nachweis [sekundär/Praxis]. Er ist auch ohne eigene Anwesenheit des Nutzers möglich, wenn der Nutzer schon in Dubai ist.
- Zustellung durch den Gerichtsvollzieher (§ 132 BGB) ist die sicherste, aber aufwendigste Variante. § 132 wurde hier nicht separat abgerufen.
- **E-Mail:** Genügt nur dort, wo Textform reicht (Verbraucher-AGB, § 309 Nr. 13). Sie ist **nie** wirksam für § 568 BGB und vertragliche Schriftformklauseln. Der Zugangsnachweis per E-Mail ist schwach. Sinnvoll sind eine Lesebestätigung bzw. die Bestätigung des Anbieters (§ 312k Abs. 4) sowie Archivierung.

Quellen:
- https://www.bundesarbeitsgericht.de/entscheidung/2-azr-68-24 [primär]
- Kommentar: https://www.gleisslutz.com/de/know-how/kein-anscheinsbeweis-fuer-zugang-bei-einwurf-einschreiben [sekundär]

---

## 2. Abmeldung Wohnsitz, Rundfunkbeitrag, Nachsendeauftrag

### 2.1 Abmeldung (BMG § 17, Stadt Mainz)
- **§ 17 Abs. 2 BMG:** Wer auszieht und keine neue Wohnung im Inland bezieht, muss sich „innerhalb von zwei Wochen nach dem Auszug“ abmelden. Die Abmeldung ist „frühestens eine Woche vor Auszug möglich“. [primär]
- Wege laut Stadt Mainz [primär]:
  - **Online-Dienst „Wohnsitz abmelden, Wegzug ins Ausland“**. Ob dafür die Online-Ausweisfunktion nötig ist, steht nicht auf der Seite → **nicht verifiziert**.
  - **Persönlich** im Bürgerbüro, Termin empfohlen.
  - **Schriftlich:** unterschriebenes Anschreiben mit Ausweiskopie per E-Mail, Post oder Fax.
  - Vertretung mit schriftlicher Vollmacht und den Original-Ausweisen beider Personen.
- Gebühr laut Mainz: keine. Eine verspätete Abmeldung kann eine Ordnungswidrigkeit sein. Danach gibt es eine Abmeldebestätigung.
- Hinweis auf mainz.de (Stand 23.10.): Störung der Plattform „Civento“, digitale Dienste eventuell eingeschränkt.
- **App:** Ein Fenster von −7 bis +14 Tagen um das Auszugsdatum erzwingen. Abmeldebestätigung als **Schlüsseldokument** speichern, sie wird für Rundfunk, TK, Versicherungen und Banken gebraucht.
- **bedingt:** Behält er eine Wohnung in DE (z. B. das Büro als Wohnsitz? Zweitwohnung?), liegt **kein** vollständiger Wegzug vor. Das hat Folgen für Steuer und Melderecht → abfragen.

Quellen:
- https://www.gesetze-im-internet.de/bmg/__17.html [primär]
- https://www.mainz.de/vv/produkte/buergeramt/wohnsitz-abmelden [primär]

### 2.2 Rundfunkbeitrag
- Abmeldung schriftlich (Brief/Einschreiben) oder über das Online-Formular des Beitragsservice. Telefonisch geht es nicht.
- Anschrift: ARD ZDF Deutschlandradio Beitragsservice, 50656 Köln.
- Benötigt werden Beitragsnummer, neue Auslandsadresse, Ende der Wohnungsinhaberschaft, Grund (Auswanderung) und **meldeamtliche Bescheinigung** (Abmeldebestätigung).
- Die Beitragspflicht läuft bis zur schriftlichen Bestätigung weiter → nachhalten. [sekundär: Verbraucherzentrale]
- Ob und wie weit man rückwirkend abmelden kann: **nicht verifiziert** (rundfunkbeitrag.de nicht abgerufen).
- **bedingt:** Ist das Büro eine Betriebsstätte, besteht eventuell eine separate Beitragspflicht für die Betriebsstätte, die getrennt abzumelden ist. **Nicht verifiziert.**

Quelle: https://www.verbraucherzentrale-niedersachsen.de/themen/rundfunkbeitrag/vom-rundfunkbeitrag-abmelden [sekundär]

### 2.3 Nachsendeauftrag (Deutsche Post)
- Ins **Ausland nachgesendet werden nur Briefe und Postkarten** (auch Groß- und Maxibriefe).
- **Nicht** ins Ausland nachgesendet werden u. a. **Einschreiben**, Pakete, Warensendungen und Dialogpost.
- Laufzeit bei Umzug: 6 Monate. Auftrag spätestens 5 Werktage vor Beginn erteilen. Preis privat laut Seite: 31,90 € online (6 Monate). Ausländische Postbetreiber können eigene Entgelte erheben. [primär, Anbieter]
- **Folge für die App:** Behördenpost, Einschreiben, Gerichts- und Finanzamtspost erreichen ihn über den Nachsendeauftrag **nicht** in Dubai. Er braucht eine deutsche Zustelladresse bzw. einen Zustellungsbevollmächtigten oder einen digitalen Postdienst. Allen Vertragspartnern muss er die neue Adresse aktiv mitteilen.

Quelle: https://deutschepost.de/de/n/nachsendeservice/haeufige-fragen.html [primär, Anbieter]

---

## 3. Gewerbe / Business (nur Flags, keine Steuerberatung)

### 3.1 Gewerbeabmeldung
- **§ 14 Abs. 1 S. 2 Nr. 3 GewO:** Wer den Betrieb aufgibt, muss das anzeigen, und zwar „gleichzeitig“ mit der Aufgabe. Ist die Aufgabe offenkundig und wird sie nicht angezeigt, kann die Behörde von Amts wegen abmelden. [primär]
- **bedingt:** Die Pflicht besteht nur, wenn es ein Gewerbe ist. Freie Berufe haben keine Gewerbeanmeldung. Wird nur die Betriebsstätte verlegt oder bleibt die Gesellschaft bestehen, sind eventuell Ummeldung oder Änderungsanzeige statt Abmeldung nötig.
- Mainz [primär]:
  - Online-Antrag „Gewerbemeldung“ (Civento-Störung beachten) oder Formular.
  - Ausweiskopie beifügen. Bei juristischen Personen meldet der gesetzliche Vertreter ab, bei Personengesellschaften alle vertretungsberechtigten Gesellschafter.
  - Gebühr laut Seite: 40 €.
  - Bearbeitung: sofort vor Ort bzw. etwa 3 Tage schriftlich oder online.
- **App fragt:** Rechtsform (Einzelunternehmen / GbR / UG / GmbH / sonstige), wird der Betrieb aufgegeben, fortgeführt oder verlegt, Handelsregistereintrag ja/nein (dann ggf. eigene HR-Anmeldung, **nicht verifiziert**), Angestellte (Abmeldungen bei Sozialversicherung, BG; **nicht recherchiert**).

Quellen:
- https://www.gesetze-im-internet.de/gewo/__14.html [primär]
- https://www.mainz.de/vv/produkte/rechtundordnungsamt/gewerbe-abmelden [primär]

### 3.2 Finanzamt und Steuer – „Berater klären“
Die App gibt nur Warnhinweise aus und erstellt eine Checkliste für den Steuerberater. Sie bewertet nichts.
- **Wegzugsbesteuerung § 6 AStG** – **bedingt**, wenn alle Bedingungen erfüllt sind [primär]:
  - Er hält Anteile an Kapitalgesellschaften im Sinne von § 17 EStG, d. h. eine Beteiligung von „mindestens 1 Prozent“ innerhalb der letzten fünf Jahre. Das betrifft z. B. GmbH/UG-Anteile, auch ausländische Gesellschaften und Depotbestände.
  - Er war mindestens 7 Jahre innerhalb der letzten 12 Jahre unbeschränkt steuerpflichtig.
  - Rechtsfolgen laut Gesetzestext: Es wird eine fiktive Veräußerung angenommen. Auf Antrag ist Ratenzahlung in 7 Jahresraten möglich, „in der Regel nur gegen Sicherheitsleistung“. Bei Rückkehr innerhalb von 7 Jahren kann der Anspruch unter Bedingungen entfallen. Meldepflichten bestehen: elektronisch binnen 1 Monat und jährlich bis zum 31.07.
  - **Wichtig:** Das muss **vor** dem Wegzug mit dem Berater geklärt werden.
- **Erweiterte beschränkte Steuerpflicht § 2 AStG** – **bedingt** [primär]:
  - Er ist Deutscher und war mindestens 5 der letzten 10 Jahre unbeschränkt steuerpflichtig.
  - Er zieht in ein Niedrigsteuergebiet. Ob die UAE darunter fallen, muss der Berater prüfen.
  - Er hat wesentliche wirtschaftliche Interessen in DE, z. B. das Unternehmen in DE.
  - Dauer: bis zu 10 Jahre. Es gilt eine Einkünfte-Schwelle von 16.500 €.
- **Betrieb und Entstrickung:**
  - Einzelunternehmen: Betriebsaufgabe oder Überführung ins Ausland kann stille Reserven aufdecken.
  - GmbH: Verlagert er die Geschäftsleitung nach Dubai, kann sich die Ansässigkeit der Gesellschaft ändern.
  - Die einschlägigen Normen (§ 4 Abs. 1 S. 3, § 16 EStG, § 12 KStG) wurden hier **nicht verifiziert**. Nur als Flag ausgeben.
- **DBA Deutschland–VAE:**
  - Das alte Abkommen ist am **31.12.2021 ausgelaufen** [sekundär, mehrfach bestätigt].
  - Ein neues DBA ist nach Stand der gesichteten Quellen **nicht in Kraft**. Laut einem Bericht laufen Verhandlungen bzw. wurde ein Abschluss angestrebt, aber ohne Unterzeichnungsdatum [sekundär].
  - Die BMF-Übersicht „Stand der DBA zum 1.1.2026“ (BMF-Schreiben vom 07.01.2026) wurde nicht abgerufen. Die BMF-Seite ist für den Abruf gesperrt (robots).
  - → **Primär nicht verifiziert.** Der Berater soll den aktuellen Stand bestätigen.
- Weitere Flags für den Berater:
  - Abmeldung bzw. Mitteilung an das Finanzamt (neue Adresse, Bekanntgabeadresse/Empfangsbevollmächtigter).
  - Vermietung oder Verkauf der Mainzer Wohnung (bei Eigentum).
  - Kapitalerträge und Freistellungsaufträge.
  - Steuerliche Ansässigkeit in den UAE nachweisen (Tax Residency Certificate; **nicht recherchiert**).

Quellen:
- https://www.gesetze-im-internet.de/astg/__6.html [primär]
- https://www.gesetze-im-internet.de/astg/__2.html [primär]
- https://www.gesetze-im-internet.de/estg/__17.html [primär]
- https://www.steuer-berater.de/magazin/deutschland-vae-neues-doppelbesteuerungsabkommen-20262149 [sekundär]
- https://kpmg.com/de/de/themen/2026/01/stand-dba-zum-1-1-2026.html [sekundär, erwähnt die VAE nicht]

---

## 4. Krankenversicherung beim Wegzug (nur Flag)
- **GKV (freiwillig versichert)**, § 191 SGB V [primär]:
  - Die Mitgliedschaft endet u. a. durch Kündigung (nach § 175 Abs. 4, Details nicht abgerufen).
  - Sie endet auch nach 6 Monaten ohne Beiträge und Leistungen, wenn kein Wohnsitz bzw. gewöhnlicher Aufenthalt im Inland feststellbar ist.
  - Folge: **aktiv kündigen bzw. mitteilen**, nicht auslaufen lassen.
- **bedingt Pflichtversicherung** (z. B. als Angestellter seiner GmbH): Sie endet mit dem Ende der Beschäftigung in DE → mit Kasse oder Berater klären.
- **PKV:** § 204 Abs. 5 VVG erwähnt die Fortführung eines gekündigten Vertrags „in Form einer Anwartschaftsversicherung“ [primär]. Zu Sonderkündigungsrechten bei Wegzug (§ 207 VVG) und zum Umfang des Weltgeltungsbereichs: **nicht verifiziert** (Abruf fehlgeschlagen).
- Pflege- und Rentenversicherung sowie die Rückkehroption (Anwartschaft) betreffen langfristige Entscheidungen → **Berater/Versicherer klären**.
- **Lücke vermeiden:** Die UAE-Pflichtversicherung (Abschnitt 6.4) muss vor dem Ende des deutschen Schutzes stehen.

Quellen:
- https://www.gesetze-im-internet.de/sgb_5/__191.html [primär]
- https://www.gesetze-im-internet.de/vvg_2008/__204.html [primär]

---

## 5. Zoll: Container mit Hausrat

### 5.1 Ausfuhr aus Deutschland/EU
- zoll.de behandelt öffentlich nur die **Einfuhr** von Übersiedlungsgut nach DE. Eine Seite zur **Ausfuhr** von Umzugsgut in einen Nicht-EU-Staat wurde **nicht gefunden**. Der direkte Abruf scheiterte. [primär, Negativbefund]
- Ob für privates Umzugsgut eine elektronische Ausfuhranmeldung (ATLAS) nötig ist oder eine vereinfachte, mündliche bzw. konkludente Anmeldung genügt: **nicht verifiziert**. In der Praxis übernimmt die Umzugsspedition die Ausfuhrabwicklung → bei der Spedition schriftlich bestätigen lassen und den Ausgangsnachweis bzw. die Ausfuhrdokumente archivieren.
- **bedingt:**
  - Firmengegenstände (Büroinventar, Ware des Unternehmens) sind **kein privates Umzugsgut**. Sie sind kommerzielle Ausfuhr mit eigener Anmeldung und eventuell umsatzsteuerlicher Relevanz → getrennt erfassen, Berater/Spedition.
  - Verbots- und Beschränkungsgüter, z. B. Waffen, Kulturgüter, Dual-Use-Güter, geschützte Arten: Prüfung erforderlich, **nicht recherchiert**.
- Containergröße, Volumen und Kosten: **keine Annahmen**. Das kommt aus dem Speditionsangebot.
- Zoll-Auskunft: https://www.zoll.de/DE/Kontakt/Auskuenfte/auskuenfte_node.html

Quelle: https://www.zoll.de/DE/Privatpersonen/Umzug-Heirat-Erbschaft-Studium/umzug-heirat-erbschaft-studium_node.html [primär]

### 5.2 Einfuhr Dubai (Dubai Customs)
- **Befreiung** [primär]:
  - Gebraucht eingeführte persönliche Gegenstände und Haushaltsgegenstände sind nach Inspektion zoll- und abgabenfrei.
  - Werden die Waren als „commercial quantities“ eingestuft, fallen **5 %** an.
- **Bedingungen** laut Seite „Customs Duty Exemptions“ [primär]:
  - Ausländer, die erstmals zum Leben in die UAE kommen, müssen **Arbeit und Wohnsitz nachweisen**.
  - Die Gegenstände müssen **gebraucht** sein, auf seinen Namen laufen und in einer zur Einrichtung eines Haushalts angemessenen Menge vorliegen.
  - Eine Packliste ist Pflicht.
  - **Neue Gegenstände sind nicht befreit.**
  - Weitere Details stehen in „Customs Policy No. DCP8“, die nicht abgerufen wurde.
- **Dokumente** für „Clearance of Personal Effects“: Passkopie, **Kopie des Residence Visa**, schriftliche Liste der Waren. Für Fahrzeuge gelten eigene Unterlagen und 5 % auf den Schätzwert. [primär]
- **bedingt Timing:** Ohne Residence Visa ist die Befreiung wahrscheinlich nicht erreichbar. Containerankunft und Visa-Erteilung müssen koordiniert werden. Wie lange Lagerung im Hafen geht und was sie kostet: **nicht verifiziert**.
- „Prüfung der Wohnsitz/Arbeit“: Wie ein Golden-Visa- oder Investor-Inhaber ohne Arbeitsvertrag „Arbeit“ nachweist, ist **nicht verifiziert** → bei Dubai Customs bzw. Spedition klären.
- **Verbote und Beschränkungen** (Auszug, nicht abschließend) [primär]:
  - Verboten u. a.: Betäubungsmittel, Glücksspielgeräte, Gegenstände gegen islamischen Glauben und öffentliche Moral.
  - Genehmigungspflichtig u. a.:
    - **Medikamente** (MOHAP)
    - **Alkohol** (Dubai Police)
    - Waffen und Feuerwerk
    - **E-Zigaretten**
    - **Bücher und Medien** (National Media Council)
    - Pflanzen, Tiere, Dünger
    - Lebensmittel und Kosmetik (Dubai Municipality)
    - **Funk- und Sendegeräte** (TRA). Drohnen sind nicht ausdrücklich genannt, **nicht verifiziert**.
- Hotline Dubai Customs laut Seite: 800 1886.

Quellen:
- https://www.dubaicustoms.gov.ae/en/eServices/ServicesForIndividuals/Pages/ClearanceOfPersonalEffects.aspx [primär]
- https://www.dubaicustoms.gov.ae/en/mobile/Pages/PermittedGoods.aspx [primär]
- https://www.dubaicustoms.gov.ae/en/mobile/Pages/ProhibitedandRestrictedGoods.aspx [primär]

---

## 6. UAE: Einreise, Aufenthalt, Behörden, Alltag

### 6.1 Einreise
- Visa on Arrival bzw. visumfreie Einreise für Deutsche: Die Dauer (z. B. 90 Tage in 180 Tagen) ist **nicht primär verifiziert**, die u.ae-Seite war nicht erreichbar. Die App fragt den aktuellen Stand bei ICP/GDRFA ab und fordert einen gültigen Pass (Restgültigkeit prüfen lassen).

### 6.2 Aufenthaltstitel für Immobilienkäufer
- **Golden Visa (Immobilieninvestor), Dubai Land Department** [primär]:
  - Immobilienwert **mindestens AED 2 Mio.** zum Kaufzeitpunkt, auch über mehrere Immobilien zusammengerechnet.
  - „wholly owned by the investor“. Ob Miteigentum genügt, steht nicht ausdrücklich da → **nicht verifiziert**.
  - **Hypothek erlaubt**, wenn ein **NOC der Bank** mit gezahltem Betrag und Restschuld vorliegt.
  - Dokumente: Pass, **e-Certificate of Title / Title Deed**, Foto, ggf. Emirates ID bzw. bestehender Aufenthaltstitel.
  - **Persönliche Anwesenheit in den UAE** ist Pflicht.
  - Gebühren laut Seite: 10-Jahres-Titel insgesamt AED 9.884,75 (aufgeschlüsselt u. a. Medical, Emirates ID, DLD-Gebühr). Bearbeitung laut Seite 7–10 Arbeitstage. Bei Antrag erneut prüfen.
- **Off-Plan:** Die DLD-Seite äußert sich **nicht** dazu. Sie verlangt Title Deed bzw. e-Certificate of Title, und ob ein Oqood-Nachweis genügt, ist offen.
  - Sekundärquellen berichten, dass Off-Plan- und finanzierte Objekte qualifizieren und die frühere Mindestzahlung (AED 1 Mio. bzw. 50 %) weggefallen ist. Genannt wird ein Rundschreiben vom 20.02.2026, maßgeblich sei die DLD-Bewertung.
  - → **Nicht primär verifiziert.** Vor Antrag bei DLD/GDRFA bestätigen.
- **Widerspruch:** u.ae listet die Laufzeit für Immobilieninvestoren laut Abruf als 5 Jahre, DLD nennt einen 10-Jahres-Titel → **ungeklärt, nicht verifiziert**.
- Alternativen sind z. B. Arbeits- bzw. Firmenvisum (Freezone/Mainland-Firma), Freelancer-Visum oder ein kürzeres Immobilienvisum unterhalb von AED 2 Mio. Die Bedingungen wurden **nicht verifiziert** und nur als Optionen genannt.
- **bedingt:** Vor Übergabe bzw. vor Title Deed ist der Golden-Visa-Weg über die Immobilie eventuell (noch) nicht möglich. Dann braucht er übergangsweise einen anderen Aufenthaltstitel. Das betrifft auch den Container-Zoll (5.2).

Quellen:
- https://dubailand.gov.ae/en/eservices/request-for-golden-visa-investor [primär]
- https://u.ae/en/information-and-services/visa-and-emirates-id/residence-visas/golden-visa [primär]
- https://www.agbi.com/news/uae-scraps-minimum-payment-for-property-golden-visa/ [sekundär]
- https://metropolitan.realestate/media/news/uae-golden-visa-mortgage-down-payment-rule-change-2026/ [sekundär, Makler]

### 6.3 Emirates ID
- Pflicht für alle Residents und an das Residence Visa gekoppelt. Mit Visa-Annullierung wird auch die ID annulliert.
- Antrag über ICP online oder Typing Center, Biometrie in einem ICP-Center.
- Laut Seite gelten u. a.: Verlust binnen 7 Tagen melden, Datenänderungen binnen 1 Monat, Verspätungsgebühr AED 20/Tag (max. AED 1.000) bei Verlängerung später als 1 Monat nach Ablauf. [primär]
- Quelle: https://u.ae/en/information-and-services/visa-and-emirates-id/emirates-id [primär]

### 6.4 Krankenversicherung Dubai (Pflicht)
- Dubai Law No. (11) of 2013 [primär]:
  - Art. 7(a): Pflicht zur Versicherung für Nationals, **Residents** und Besucher.
  - Art. 9(a)(2), 10: Für Angestellte ist der Arbeitgeber verantwortlich.
  - Art. 9(a)(3), 11: Für Personen ohne Arbeitgeber ist der **Sponsor** verantwortlich.
  - **bedingt:** Als Golden-Visa- oder Selbst-Sponsor trägt er die Versicherung voraussichtlich selbst. DLD verlangt Krankenversicherung jedenfalls für Familienangehörige. Ob sie für den Antragsteller beim Golden Visa vorab nachzuweisen ist: **nicht verifiziert**.
- Mindestumfang, DHA-Anforderungen und Bußgelder: **nicht verifiziert** (u.ae-Gesundheitsseite nicht erreichbar).
- Quelle: https://dlp.dubai.gov.ae/Legislation%20Reference/2013/Law%20No.%20(11)%20of%202013.html [primär]

### 6.5 DEWA (Strom/Wasser)
- Die DEWA-Seite „Move-in“ war **nicht erreichbar**. Dokumente (Title Deed bzw. Ejari, Emirates ID/Pass), Kaution und Dauer sind **nicht verifiziert**.
- **bedingt:** Als Eigentümer nach Übergabe braucht er wahrscheinlich Title Deed oder Übergabeunterlagen. Bei Zwischenmiete läuft es über Ejari.
- Quelle (nicht erreichbar): https://dewa.gov.ae/en/about-us/service-guide/consumer-services/move-in

### 6.6 Bankkonto
- Kontoeröffnung, KYC-Anforderungen und ob ein Konto ohne Emirates ID möglich ist: **nicht recherchiert/verifiziert**.
- Für den Golden Visa wird bei Familiennachzug eine IBAN verlangt (DLD). Ein Hypothekenkonto ist bankabhängig.

### 6.7 Führerschein
- Laut Gulf News (Stand 11.10.2025) ist Deutschland auf der Liste der Länder für den direkten Umtausch [sekundär].
- Voraussetzungen danach: gültige Emirates ID, elektronischer Sehtest, gültiger deutscher Führerschein, Mindestalter 18.
- Die RTA-Seite zeigt die Länderliste im Abruf nicht → **primär nicht verifiziert**. Übersetzungspflicht: **nicht verifiziert**.
- **bedingt:** erst nach Residence Visa bzw. Emirates ID möglich.
- Quellen:
  - https://www.rta.ae/wps/portal/rta/ae/home/rta-services/service-details?serviceId=120 [primär, Liste nicht lesbar]
  - https://gulfnews.com/ask-gulf-news/ask-gulf-news-want-to-drive-in-dubai-check-if-your-countrys-licence-is-eligible-for-exchange-1.500302931 [sekundär]

---

## 7. Dubai-Immobilie (Off-Plan) – allgemein, nicht zur konkreten Einheit

### 7.1 Oqood / Interim Register
- Law No. (13) of 2008 [primär]:
  - Art. 3(1): Off-Plan-Verfügungen sind **nichtig, wenn sie nicht** im Interim Property Register eingetragen sind.
  - Art. 4: Der Entwickler darf erst mit Grundbesitz und Genehmigungen verkaufen.
  - Art. 8: Nach dem Completion Certificate trägt der Entwickler das Projekt ins Property Register ein und überträgt die Einheiten auf die Käufer, wenn diese ihre Pflichten erfüllt haben. Die DLD kann das auch auf Antrag des Käufers tun.
  - Art. 11: Bei Zahlungsverzug des **Käufers** benachrichtigt der Entwickler die DLD, es gilt eine Frist von 30 Tagen. Danach kann er den Vertrag auflösen und **bis zu 30 %** einbehalten (laut abgerufenem Text). Die Online-Fassung trägt © 2014, spätere Änderungen sind **nicht verifiziert**.
- **App:** Oqood-Zertifikat bzw. Eintragungsnachweis anfordern und speichern. Alle Zahlungsfristen des Zahlungsplans mit Erinnerungen versehen, weil bei Verzug das Risiko eines Teilverlusts besteht.
- Registrierungsgebühr (häufig „4 %“ genannt): auf DLD-Seiten so **nicht bestätigt**. Die FAQ nennt 4 % nur in anderem Kontext → **nicht verifiziert**.

### 7.2 Escrow
- Law No. (8) of 2007 [primär]:
  - Art. 7, 9: Käuferzahlungen gehen auf ein projektbezogenes Treuhandkonto. Die Mittel sind nur für den Bau bestimmt und vor Gläubigern des Entwicklers geschützt.
  - Art. 14: 5 % werden nach Fertigstellung einbehalten und erst ein Jahr nach Umschreibung auf die Käufer ausgezahlt.
  - Art. 15: Bei Nichtfertigstellung muss der Treuhänder nach Rücksprache mit der DLD die Fertigstellung sichern **oder Käufer erstatten**.
- DLD-FAQ: Auszahlungen erfolgen nach geprüften Baufortschritts-Meilensteinen. Auch Hypothekengelder für Off-Plan fließen aufs Escrow-Konto. [primär]
- **App:** Zahlungen nur an das Escrow-Konto des Projekts. Den Begünstigten gegen offizielle DLD- bzw. Entwicklerangaben prüfen. Bei IBAN-Änderung per E-Mail eine Betrugswarnung ausgeben.

### 7.3 Title Deed bei Übergabe
- Nach 100 %-Fertigstellung, Vermessung und Gebührenzahlung durch den Entwickler werden die Title Deeds registriert (DLD-FAQ). Voraussetzung ist, dass der Käufer seine Pflichten erfüllt hat (Law 13/2008 Art. 8). [primär]
- **Snagging:** Ein gesetzliches Snagging-Verfahren wurde **nicht gefunden**. Relevant ist der 5 %-Einbehalt für Mängel im ersten Jahr (DLD-FAQ). Weitere Mängelhaftung nach UAE-Zivilrecht: **nicht verifiziert**.
  - **App:** Checkliste für die Abnahme mit Foto-Protokoll, Mängelliste schriftlich an den Entwickler, Fristen aus dem SPA übernehmen.

### 7.4 Hypothek / LTV (Central Bank UAE)
- Regulations Regarding Mortgage Loans, Art. 3 (Loan-to-Value) [primär]:
  - Expats, erste Immobilie bzw. Eigennutzung: **max. 80 %** bei Wert unter AED 5 Mio., **max. 70 %** über AED 5 Mio.
  - Zweit- oder Investitionsimmobilie: **max. 60 %**.
  - **Off-Plan: max. 50 %** des Werts, unabhängig von Zweck, Wert und Käufergruppe.
- **Konsequenz (bedingt):** Eine geplante Finanzierung von etwa 60 % ist **in der Off-Plan-Phase nach diesem Regelwerk nicht zulässig**. Möglich wäre sie erst nach Fertigstellung, wenn das Objekt als fertige Immobilie finanziert wird, oder als Zweit- bzw. Investitionsobjekt (max. 60 %). Was im konkreten Fall gilt, müssen Bank und Mortgage-Berater klären.
- **Nicht-Residents:** Im abgerufenen Artikel nicht geregelt. Bankpraxis und eventuelle niedrigere Grenzen sind **nicht verifiziert**.
- Ob der Wert über oder unter AED 5 Mio. liegt (der Rand „genau 5 Mio.“ ist im Text nicht geregelt), muss der Nutzer eingeben. **Keine Annahme zur Einheit.**
- Quelle: https://rulebook.centralbank.ae/node/2856 [primär]

### 7.5 Service Charges (RERA/Mollak)
- Service Charges sind jährliche, **von RERA genehmigte** Beträge. Der Anteil richtet sich nach der Fläche im Title Deed.
- Rechnungsstellung und Zahlung laufen über **Mollak** (E-Mail/SMS). Verwalter dürfen vor RERA-Genehmigung nichts erheben.
- Den Service-Charge-Index gibt es auf der DLD-Website bzw. in der App „Dubai REST“, Beschwerden laufen über Dubai REST. [primär, DLD-FAQ]
- Rechtsgrundlage (Jointly Owned Property, Law No. 6 of 2019): **nicht verifiziert**.

Quellen:
- https://dlp.dubai.gov.ae/Legislation%20Reference/2008/Law%20No.%20(13)%20of%202008.html [primär]
- https://dlp.dubai.gov.ae/Legislation%20Reference/2007/Law%20No.%20(8)%20of%202007.html [primär]
- https://dubailand.gov.ae/en/faq [primär; nur die ersten ca. 100k Zeichen ausgewertet]

---

## 8. Datenschutz (kurz)
- Die DSGVO-Drittlandübermittlung (Art. 44 ff.) ist relevant, wenn Daten an Anbieter in den USA gehen (z. B. Supabase, Vercel, Anthropic) oder in die UAE.
- EU-US Data Privacy Framework:
  - Angemessenheitsbeschluss von 2023, vom EuG am **03.09.2025** bestätigt (Latombe, T-553/23).
  - Rechtsmittel zum EuGH am **31.10.2025** eingelegt. Der Stand im Oktober 2026 ist **nicht verifiziert** [sekundär].
  - Fällt das DPF, sind Standardvertragsklauseln nötig.
- **Pro Anbieter prüfen** (alles **nicht verifiziert**):
  - Gibt es einen DPA/AVV mit SCCs? Ist der Anbieter DPF-zertifiziert?
  - Region wählbar? Supabase-Projekt in der EU, Vercel-Function-Region, Datenhaltung und Aufbewahrung bei Anthropic API.
  - Liste der Unterauftragsverarbeiter.
- **bedingt:**
  - Nutzt er die App nur für sich persönlich, greift eventuell die Haushaltsausnahme (Art. 2 Abs. 2 lit. c DSGVO). Daten Dritter wie Vermieter oder Ansprechpartner sind trotzdem sparsam zu speichern.
  - Wohnt er in den UAE, kann zusätzlich das UAE-Datenschutzrecht (PDPL) relevant sein, **nicht recherchiert**.
- **App:**
  - Ausweis-, Pass-, Visa- und Bankdokumente verschlüsselt speichern.
  - Keine Ausweisnummern in LLM-Prompts, Logs oder Analytics.
  - Regionen fest konfigurieren.

Quellen:
- https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20251201-european-court-of-justice-to-review-challenge-to-eu-us-data-privacy-framework [sekundär]
- https://digitalpolicyalert.org/event/35459 [sekundär]

---

## Nicht erreichbar / nicht verifiziert (Sammelliste)
- **zoll.de:** keine Seite zur Ausfuhr von Umzugsgut gefunden.
- **BMF:** DBA-Länderseite (robots-gesperrt).
- **BGB § 126** (qES als Ersatz der Schriftform), **VVG § 207**: Abruf fehlgeschlagen.
- **u.ae:** Gesundheitsversicherung und Visa on Arrival.
- **DEWA** Move-in.
- **DLD** Off-Plan-Registrierungsseite.
- **RTA:** Länderliste.
- **Golden Visa:** Off-Plan-Eignung und Laufzeit (5 vs. 10 Jahre) primär unbestätigt.
- **DBA DE–VAE:** aktueller Status nur sekundär.
- **CBUAE:** LTV-Grenzen für Nicht-Residents.

---

## App-Regeln abgeleitet

| # | Bereich | Regel, die die Software erzwingen muss |
|---|---|---|
| R1 | Wohnraum | Eine Wohnraumkündigung wird **niemals** als wirksam markiert, wenn sie per E-Mail, Fax, Scan oder Messenger verschickt wurde. Ausgabe nur als druckbares PDF mit Unterschriftsfeld. Status „wirksam versendet“ gibt es erst nach Upload eines Zugangsnachweises. |
| R2 | Wohnraum | Fristrechner § 573c: Zugang beim Vermieter spätestens am 3. Werktag. Samstag konservativ **nicht** als Werktag zählen und einen Postlaufpuffer einrechnen. Vertragliche kürzere Fristen dürfen nur angewandt werden, wenn der Nutzer sie bestätigt; eine längere Mieterfrist wird nie übernommen. |
| R3 | Wohnraum | Kein „Sonderkündigungsrecht Auslandsumzug“ anbieten. Stattdessen Optionen „ordentliche Kündigung“, „Aufhebungsvertrag anfragen“ oder „Nachmieterklausel prüfen“. |
| R4 | Mitmieter | Sind mehrere Mieter oder Vertragsparteien erfasst, werden alle Unterschriftsfelder erzeugt. Ohne alle Unterschriften wird der Status gesperrt. |
| R5 | Gewerbe/Büro | Standard ist Schriftform (Vertragsklausel). Gesetzliche Frist § 580a Abs. 2 (Quartal) nur bei **unbefristetem** Vertrag. Bei Befristung lautet der Hinweis „nicht ordentlich kündbar – Anwalt“. Die Vertragspartei (Person vs. GmbH) bestimmt den Unterzeichner. |
| R6 | Lagerraum | Vertragstyp (Miete/Verwahrung) und Frist müssen aus dem Vertrag erfasst werden, sonst keine Fristberechnung. Fallback ist die gesetzliche Frist § 580a mit Warnhinweis. Der Räumungstermin muss vor dem Vertragsende liegen, außerdem Warnung zum Pfandrecht bei Rückständen. |
| R7 | Verbraucher | Textform (E-Mail/Button) als ausreichend markieren, wenn § 309 Nr. 13 greift. Bei Online-Abschluss den § 312k-Button bevorzugen und Bestätigungsseite sowie Bestätigungsmail archivieren. Ohne Eingangsbestätigung nach X Tagen Mahnung erzeugen. |
| R8 | Verbraucher | Fehlt der Kündigungsbutton laut Nutzer, Hinweis „fristlos nach § 312k Abs. 6 möglich“ als Option (mit Beleg-Screenshot). |
| R9 | TK | Sonderkündigung § 60 Abs. 2 TKG mit 1 Monat Frist nur für **Verbraucherverträge** anbieten, mit Hinweis „Auslandsanwendung nicht gesetzlich ausdrücklich“. Abmeldebestätigung anhängen. Vorher Fragen zu Rufnummernportierung, 2FA-Nummern und Provider-Mailadresse erzwingen. |
| R10 | Zugang | Jede Kündigung braucht eine Versandart. Bei Einwurf-Einschreiben wird automatisch eine Aufgabe „Auslieferungsbeleg bei Deutscher Post anfordern“ angelegt (BAG 2 AZR 68/24). Ein Übergabe-Einschreiben für fristkritische Kündigungen nicht empfehlen. Für Boten ein Botenprotokoll-Template (Zeuge, Inhalt gelesen, Einwurf, Datum/Uhrzeit). |
| R11 | Fristen | Alle Fristen nach **Zugang** berechnen, nicht nach Absendedatum. Bei Versand aus Dubai gilt ein zusätzlicher Puffer bzw. Botenversand in DE. |
| R12 | Abmeldung | Abmeldetermin nur im Fenster [Auszug −7 Tage, Auszug +14 Tage] zulassen. Die Abmeldebestätigung ist Pflichtanhang für Rundfunk, TK und Versicherungen. |
| R13 | Reihenfolge | Abhängigkeiten erzwingen: Steuerberatertermin (Wegzug § 6/§ 2 AStG, DBA) **vor** Abmeldung und Gewerbeabmeldung. Neue KV in den UAE wirksam **vor** dem Ende der deutschen KV. Residence Visa **vor** der Container-Ankunft in Dubai. |
| R14 | Post | Hinweis „Einschreiben und Pakete werden nicht ins Ausland nachgesendet“. Eine deutsche Zustell- oder Bevollmächtigtenadresse ist Pflicht, bevor der Status „Wegzug fertig“ gesetzt wird. |
| R15 | Steuer | Steuerthemen nur als Flags mit dem Text „Berater klären“. Keine Berechnung und keine Aussage „fällt (nicht) an“. |
| R16 | Container | Firmengegenstände getrennt von privatem Umzugsgut erfassen. Die Packliste ist eine Pflichtliste mit Kennzeichen „neu/gebraucht“ und „genehmigungspflichtig“ (Medikamente, Alkohol, E-Zigaretten, Medien, Funkgeräte, Pflanzen, Waffen). Keine Annahmen zur Containergröße. |
| R17 | Immobilie | Keine Aussagen über die konkrete Einheit generieren, nur aus vom Nutzer hochgeladenen Dokumenten (SPA, Oqood, Zahlungsplan). Fälligkeiten des Zahlungsplans als harte Erinnerungen setzen (Verzugsrisiko Law 13/2008 Art. 11). |
| R18 | Escrow | Zahlungsempfänger muss das Projekt-Escrow-Konto sein. Bei IBAN-Abweichung oder -Änderung per E-Mail eine Betrugswarnung ausgeben und die Freigabe sperren, bis eine Verifikation erfolgt ist. |
| R19 | Hypothek | LTV-Check: Off-Plan max. 50 %. Fertig, Expat, erste Immobilie: 80 % unter bzw. 70 % über AED 5 Mio. Zweit- oder Investitionsobjekt: 60 %. Bei einem Eingabewert über der Grenze warnen „mit Bank klären“. |
| R20 | Golden Visa | Golden Visa erst als „möglich“ markieren, wenn Wert ≥ AED 2 Mio. **und** Title Deed bzw. e-Certificate vorliegt **und** (bei Hypothek) ein Bank-NOC vorliegt. Off-Plan und Miteigentum als „bei DLD/GDRFA bestätigen“ markieren. |
| R21 | Quellen | Jede Regel speichert Quelle, Abrufdatum und Status (primär/sekundär/nicht verifiziert). Nach 6 Monaten erscheint ein Re-Check-Hinweis, bei UAE-Themen nach 3 Monaten. |
| R22 | Datenschutz | Ausweis-, Pass-, Visa- und Bankdaten verschlüsselt speichern und nie an das LLM, Logs oder Analytics übergeben. Speicherregion EU konfigurieren. AVV/DPA je Anbieter dokumentieren, bevor echte Daten gespeichert werden. |
