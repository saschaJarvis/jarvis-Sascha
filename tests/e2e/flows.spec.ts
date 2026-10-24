import { test, expect } from '@playwright/test';
import { finishOnboarding, signUpWithMfa, totpNow, uniqueEmail } from './helpers';

test.describe.configure({ mode: 'serial' });

test('Anmeldung verlangt Authenticator; ohne Code kein Zugriff', async ({ page }) => {
  const email = uniqueEmail('mfa');
  const secret = await signUpWithMfa(page, email);
  await finishOnboarding(page, 'Testi', false);
  // Abmelden, neu anmelden: nach dem Passwort kommt die Code-Abfrage
  await page.goto('/leben/einstellungen');
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  await page.getByLabel('E-Mail').fill(email);
  await page.getByLabel('Passwort').fill('Test-Passwort-123!');
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page).toHaveURL(/sicherheit\/code/);
  // App-Seiten bleiben ohne Code gesperrt
  await page.goto('/');
  await expect(page).toHaveURL(/sicherheit\/code/);
  await page.getByLabel('6-stelliger Code').fill('000000');
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('stimmt nicht');
  // gleicher Code wie bei der Einrichtung = Replay → abgelehnt; nächster Zeitschritt geht
  await page.getByLabel('6-stelliger Code').fill(totpNow(secret, 1));
  await page.getByRole('button', { name: 'Bestätigen' }).click();
  await expect(page.getByText('Alles im Griff.')).toBeVisible();
});

test('Hauptablauf: Onboarding, Heute, Schnellerfassung, Aufgabe mit Nachweis, Beispiel-Kündigung', async ({ page, browser }) => {
  await signUpWithMfa(page, uniqueEmail('sascha'));
  await finishOnboarding(page, 'Sascha', true);

  // Heute: genau eine Hauptaktion, max. 2 weitere
  await expect(page.getByText('Jetzt das')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sascha');
  const also = page.locator('section:has(h2:text("Auch wichtig")) li');
  expect(await also.count()).toBeLessThanOrEqual(2);

  // Schnellerfassung
  await page.getByLabel('Was soll ich mir merken?').fill('Erinnere mich nächste Woche, die Bank anzurufen');
  await page.getByRole('button', { name: 'Merken' }).click();
  await expect(page.locator('p[role="status"]')).toContainText('Bank anrufen');
  await expect(page.locator('p[role="status"]')).toContainText('Montag');

  // Aufgabe mit Nachweispflicht: Lagerraum ausmessen
  await page.goto('/aufgaben');
  await page.getByRole('link', { name: /Lagerraum ausmessen/ }).click();
  await page.waitForURL(/\/aufgaben\/[0-9a-f-]{36}$/);
  const taskUrl = page.url();
  await page.getByRole('button', { name: 'Jetzt anfangen' }).click();
  await expect(page.getByText('In Arbeit').first()).toBeVisible();
  await page.getByRole('button', { name: 'Erledigt – Nachweis hochladen' }).click();
  await expect(page.getByText('Nachweis fehlt').first()).toBeVisible();
  // Gefährliche Datei wird gesperrt
  const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
  await page.getByLabel('Foto oder PDF').setInputFiles({ name: 'virus.pdf', mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.4\n${eicar}`) });
  await page.getByRole('button', { name: 'Hochladen' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('gefährlich');
  // Falscher Typ wird abgelehnt
  await page.getByLabel('Foto oder PDF').setInputFiles({ name: 'tool.pdf', mimeType: 'application/pdf', buffer: Buffer.from('MZ\x90\x00 kein pdf') });
  await page.getByRole('button', { name: 'Hochladen' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('nicht erlaubt');
  // Echtes Foto (PNG)
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.getByLabel('Foto oder PDF').setInputFiles({ name: 'lager.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Hochladen' }).click();
  await expect(page.locator('p[role="status"]')).toContainText('Hochgeladen');
  await page.getByRole('button', { name: 'Nachweis passt – bestätigen' }).click();
  await expect(page.getByText('Bestätigt').first()).toBeVisible();
  await page.getByRole('button', { name: 'Abschließen' }).click();
  await expect(page.getByText('Erledigt', { exact: true }).first()).toBeVisible();

  // Fremder Nutzer sieht die Aufgabe nicht (RLS → 404)
  const other = await browser.newContext({ baseURL: page.url().split('/aufgaben')[0] });
  const p2 = await other.newPage();
  await signUpWithMfa(p2, uniqueEmail('fremd'));
  await finishOnboarding(p2, 'Fremd', false);
  const res = await p2.goto(taskUrl);
  expect(res?.status()).toBe(404);
  await expect(p2.getByText(/Lagerraum ausmessen/)).toHaveCount(0);
  await other.close();

  // Beispiel-Kündigung Büromietvertrag Mainz – Akzeptanztest
  await page.goto('/leben/vertraege');
  await page.getByRole('link', { name: /Büromietvertrag Mainz/ }).click();
  await expect(page.getByText(/Hier wird niemals etwas verschickt/)).toBeVisible();
  await expect(page.getByText('unbekannt – bitte prüfen').first()).toBeVisible();   // Unbekanntes bleibt leer
  await page.getByRole('button', { name: 'Kündigung vorbereiten' }).click();
  await page.getByRole('button', { name: 'Entwurf erstellen' }).click();
  await expect(page.getByText(/Noch offen:/)).toBeVisible();
  const draft = await page.getByLabel('Entwurf').inputValue();
  expect(draft).toContain('zum nächstmöglichen Zeitpunkt');
  expect(draft).toContain('[BITTE ERGÄNZEN: Name des Vertragspartners');
  await page.getByText(/Prüfpunkte/).first().click();
  await expect(page.getByText('Befristet oder unbefristet?')).toBeVisible();
  await page.getByRole('button', { name: 'Zur Freigabe' }).click();
  await expect(page.getByText('Letzte Ansicht vor der Freigabe')).toBeVisible();
  const approve = page.getByRole('button', { name: 'Simuliert freigeben' });
  await expect(approve).toBeDisabled();
  await page.getByLabel(/gebe ihn für einen simulierten Versand frei/).check();
  await approve.click();
  await expect(page.getByText(/Simulierte Freigabe am/)).toBeVisible();
  await page.getByRole('button', { name: 'Simuliert senden' }).click();
  await expect(page.getByText('Versandbeleg – SIMULIERT')).toBeVisible();
  await expect(page.getByText('Es wurde nichts verschickt.')).toBeVisible();
  await page.getByRole('button', { name: 'Zugangsnachweis liegt vor' }).click();
  await page.getByRole('button', { name: 'Bestätigung erhalten' }).click();
  await page.getByRole('button', { name: 'Vorgang abschließen' }).click();
  await expect(page.locator('p[role="alert"]')).toContainText('Checkliste unvollständig');
  for (const item of ['Schriftliche Bestätigung erhalten', 'Übergabeprotokoll unterschrieben', 'Alle Schlüssel zurückgegeben', 'Schlussrechnung geprüft/bezahlt', 'Kaution zurückerhalten']) {
    await page.locator('li', { hasText: item }).getByRole('button', { name: item === 'Kaution zurückerhalten' ? 'entfällt' : 'erledigt' }).click();
    await expect(page.locator('li', { hasText: item }).locator('span.line-through')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Vorgang abschließen' }).click();
  await expect(page.getByText('✓ Abgeschlossen')).toBeVisible();

  // Überfordert: genau eine Sache
  await page.goto('/heute/ruhig');
  await expect(page.getByRole('heading', { name: 'Nur eine Sache. Der Rest wartet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Erinnerungen 24 Stunden pausieren' }).click();
  await expect(page.getByText(/Erinnerungen pausiert bis/)).toBeVisible();
});
