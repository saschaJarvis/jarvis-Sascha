import { test, expect } from '@playwright/test';
import { finishOnboarding, signUpWithMfa, uniqueEmail } from './helpers';

// CRYPTO_FAKE=1: statt XRP Ledger liefert der Server feste Testwerte.
test('Krypto nur ansehen: Seed wird abgewiesen, Tippfehler erkannt, Adresse zeigt Bestand', async ({ page }) => {
  await signUpWithMfa(page, uniqueEmail('xrp'));
  await finishOnboarding(page, 'Sascha', false);
  await page.goto('/leben/finanzen');
  await expect(page.getByText(/kann damit nichts versenden/)).toBeVisible();

  const addr = page.getByLabel('Öffentliche XRP-Adresse');
  await addr.fill('abandon ability able about above absent absorb abstract absurd abuse access accident');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/NICHT gespeichert/)).toBeVisible();

  await addr.fill('rQdX87Eqmhvcw2HD1eWrRUdrbyzsgG7P6');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/Prüfsumme/)).toBeVisible();

  await addr.fill('rQdX87Eqmhvcw2HD1eWrRUdrbyzsgG7P5');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/„Ledger“ hinzugefügt/)).toBeVisible();
  await page.reload();
  await expect(page.getByText('1.234,50 XRP').first()).toBeVisible();
  await expect(page.getByText(/≈ 2\.469,00 €/).first()).toBeVisible();
  await page.getByText(/Letzte Bewegungen/).click();
  await expect(page.getByText('+250,00 XRP')).toBeVisible();
});
