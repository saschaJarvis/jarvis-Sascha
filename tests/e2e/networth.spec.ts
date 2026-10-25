import { test, expect } from '@playwright/test';
import { finishOnboarding, signUpWithMfa, uniqueEmail } from './helpers';

// CRYPTO_FAKE=1: XRP 1.234,5 à 2,2 USD; Gold 3.110,34768 USD/oz (= 100 USD/g).
test('Gesamtvermögen: Konto + Gold + Krypto werden in AED addiert und auf der Brücke gezeigt', async ({ page }) => {
  await signUpWithMfa(page, uniqueEmail('nw'));
  await finishOnboarding(page, 'Sascha', false);
  await page.goto('/leben/finanzen');

  await page.getByLabel('Name', { exact: true }).fill('Emirates NBD Giro');
  await page.getByLabel('Kontostand').fill('10.000');
  await page.getByRole('button', { name: 'Konto hinzufügen' }).click();
  await expect(page.getByText('„Emirates NBD Giro“ hinzugefügt.')).toBeVisible();

  await page.locator('#g-label').fill('Barren 100 g');
  await page.getByLabel('Menge').fill('100');
  await page.getByRole('button', { name: 'Gold hinzufügen' }).click();
  await expect(page.getByText('„Barren 100 g“ hinzugefügt.')).toBeVisible();

  await page.getByLabel('Öffentliche Adresse (BTC, ETH, XRP, ADA oder ALGO)').fill('rQdX87Eqmhvcw2HD1eWrRUdrbyzsgG7P5');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/hinzugefügt – nur zum Ansehen/)).toBeVisible();

  // 10.000 + 100 g × 0,999 × 100 USD × 3,6725 (= 36.688,28) + 1.234,5 × 2,2 × 3,6725 (= 9.974,24) = 56.662,52 → 56.662 AED
  await page.reload();
  await expect(page.getByText('56.662 AED').first()).toBeVisible();
  await page.goto('/');
  const panel = page.getByRole('region', { name: /Finanzen/ }).or(page.locator('section', { hasText: 'Gesamtvermögen' })).first();
  await expect(panel.getByText('56.662 AED')).toBeVisible();

  // Kontostand aktualisieren → Summe ändert sich
  await page.goto('/leben/finanzen');
  await page.getByText('Kontostand aktualisieren').click();
  await page.getByLabel('Neuer Kontostand Emirates NBD Giro').fill('12.000,00');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Kontostand aktualisiert.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('58.662 AED').first()).toBeVisible();
});
