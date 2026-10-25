import { test, expect } from '@playwright/test';
import { finishOnboarding, signUpWithMfa, uniqueEmail } from './helpers';

// CALENDAR_FAKE=1 (nur lokale Anmeldung): statt echtem Abruf liefert der Server einen Test-Kalender.
test('iPhone-Kalender: Link prüfen, verbinden, Termine in den Reitern, trennen', async ({ page }) => {
  await signUpWithMfa(page, uniqueEmail('kal'));
  await finishOnboarding(page, 'Sascha', false);
  await page.goto('/kalender');
  await expect(page.getByText('iPhone-Kalender verbinden').first()).toBeVisible();

  // Fremde Adresse wird abgelehnt (Schutz vor Missbrauch des Servers)
  await page.getByLabel('Kalender-Link').fill('https://evil.example.com/kalender.ics');
  await page.getByRole('button', { name: 'Kalender verbinden' }).click();
  await expect(page.getByText(/Unbekannter Kalender-Anbieter/)).toBeVisible();

  await page.getByLabel('Kalender-Link').fill('webcal://p52-caldav.icloud.com/published/2/TESTTESTTEST');
  await page.getByLabel('Name in Jarvis').fill('Privat');
  await page.getByRole('button', { name: 'Kalender verbinden' }).click();
  await expect(page.getByText(/„Privat“ ist verbunden/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/● verbunden · \d+ Termine/)).toBeVisible();
  // Link wird nie vollständig angezeigt
  await expect(page.getByText('TESTTESTTEST')).toHaveCount(0);

  // Heute: ganztägiger Termin; morgen: Termin mit Uhrzeit und Ort
  await expect(page.getByRole('tabpanel')).toContainText('Ganztägig heute');
  const selected = page.getByRole('tab', { selected: true });
  if ((await selected.textContent())?.startsWith('So')) {
    await page.getByRole('button', { name: 'Nächste Woche' }).click();
    await page.getByRole('tab').first().click();
  } else {
    await selected.press('ArrowRight');
  }
  await expect(page.getByRole('tabpanel')).toContainText('Testtermin aus dem iPhone');
  await expect(page.getByRole('tabpanel')).toContainText('Dubai Marina');

  // Brücke zeigt den Kalender-Status
  await page.goto('/');
  await expect(page.getByText('1/1 ok')).toBeVisible();

  // Trennen
  await page.goto('/kalender');
  await page.getByRole('button', { name: 'Trennen' }).click();
  await expect(page.getByText(/● verbunden/)).toHaveCount(0);
});
