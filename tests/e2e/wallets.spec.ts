import { test, expect } from '@playwright/test';
import { finishOnboarding, signUpWithMfa, uniqueEmail } from './helpers';

// CRYPTO_FAKE=1: statt XRP Ledger liefert der Server feste Testwerte.
test('Krypto nur ansehen: Seed wird abgewiesen, Tippfehler erkannt, Adresse zeigt Bestand', async ({ page }) => {
  await signUpWithMfa(page, uniqueEmail('xrp'));
  await finishOnboarding(page, 'Sascha', false);
  await page.goto('/leben/finanzen');
  await expect(page.getByText(/kann damit nichts versenden/)).toBeVisible();

  const addr = page.getByLabel('Öffentliche Adresse (XRP oder Ethereum)');
  await addr.fill('abandon ability able about above absent absorb abstract absurd abuse access accident');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/NICHT gespeichert/)).toBeVisible();

  await addr.fill('rQdX87Eqmhvcw2HD1eWrRUdrbyzsgG7P6');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/Prüfsumme/)).toBeVisible();

  await addr.fill('rQdX87Eqmhvcw2HD1eWrRUdrbyzsgG7P5');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/„Ledger XRP“ hinzugefügt/)).toBeVisible();
  await page.reload();
  await expect(page.getByText('1.234,50 XRP').first()).toBeVisible();
  await expect(page.getByText(/≈ 2\.469,00 €/).first()).toBeVisible();
  await page.getByText(/Letzte Bewegungen/).click();
  await expect(page.getByText('+250,00 XRP')).toBeVisible();

  // Ethereum: privater Schlüssel wird abgewiesen, Adresse mit Prüfsumme angenommen, Art automatisch erkannt
  await page.getByText('+ Wallet-Adresse hinzufügen (XRP / ETH)').click();
  await addr.fill('0x' + '4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/NICHT gespeichert/)).toBeVisible();
  await addr.fill('0x11A429C59856c4bF5fB029B7c1d7139456357887');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/Prüfsumme der Groß-\/Kleinschreibung/)).toBeVisible();
  await addr.fill('0x11A429C59856c4bF5fB029B7c1d7139456357886');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/„Ledger ETH“ hinzugefügt/)).toBeVisible();
  await page.reload();
  await expect(page.getByText('1,5000 ETH', { exact: true })).toBeVisible();
  await expect(page.getByText('+ 500,00 USDC')).toBeVisible();
  await expect(page.getByRole('link', { name: /0x11A4…7886/ })).toHaveAttribute('href', /etherscan\.io\/address\/0x11A4/);
});
