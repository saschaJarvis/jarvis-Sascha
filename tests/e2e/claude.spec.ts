import { test, expect } from '@playwright/test';
import { finishOnboarding, signUpWithMfa, uniqueEmail } from './helpers';

// Läuft mit CLAUDE_FAKE=1 (nur lokale Anmeldung) – keine echten KI-Aufrufe.
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');

test('Hochladen & sortieren + Chat: Einwilligung, Einordnung, Vorschläge nur im Eingang', async ({ page }) => {
  await signUpWithMfa(page, uniqueEmail('claude'));
  await finishOnboarding(page, 'Sascha', false);

  // Brücke: Knopf vorhanden, Einwilligung noch offen → Häkchen + Sortieren
  await page.goto('/leben/dokumente');
  await page.locator('#sort-files').setInputFiles({ name: 'telekom-rechnung.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByLabel(/Einverstanden: Hochgeladene Dokumente/).check();
  await page.getByRole('button', { name: 'Sortieren', exact: true }).click();
  await expect(page.getByText('gelesen von Claude')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('→ Abos')).toBeVisible();
  await expect(page.getByRole('link', { name: /1 Aufgabe im Eingang prüfen/ })).toBeVisible();

  // Vorschlag liegt nur als „zu prüfen“ im Eingang
  await page.goto('/eingang');
  await expect(page.getByText('Testrechnung prüfen und bezahlen')).toBeVisible();

  // Zweites Hochladen: Einwilligung gespeichert → sortiert sofort beim Auswählen
  await page.goto('/');
  await page.locator('#sort-files').setInputFiles({ name: 'reisepass-scan.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([PDF, Buffer.from('x')]) });
  await expect(page.getByText('→ Ausweise')).toBeVisible({ timeout: 15000 });

  // Chat
  await page.goto('/jarvis');
  await page.getByLabel('Deine Frage').fill('Was steht an?');
  await page.getByRole('button', { name: 'Senden' }).click();
  await expect(page.getByText(/Testantwort auf: „Was steht an\?“/)).toBeVisible({ timeout: 15000 });
  await page.goto('/eingang');
  await expect(page.getByText('Testvorschlag aus dem Chat')).toBeVisible();
});
