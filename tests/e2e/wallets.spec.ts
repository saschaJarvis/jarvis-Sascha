import { test, expect } from '@playwright/test';
import { finishOnboarding, signUpWithMfa, uniqueEmail } from './helpers';

// CRYPTO_FAKE=1: statt XRP Ledger liefert der Server feste Testwerte.
test('Krypto nur ansehen: Seed wird abgewiesen, Tippfehler erkannt, Adresse zeigt Bestand', async ({ page }) => {
  await signUpWithMfa(page, uniqueEmail('xrp'));
  await finishOnboarding(page, 'Sascha', false);
  await page.goto('/leben/finanzen');
  await expect(page.getByText(/kann damit nichts versenden/)).toBeVisible();

  const addr = page.getByLabel('Öffentliche Adresse (BTC, ETH, XRP, ADA oder ALGO)');
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
  await page.getByText('+ Wallet-Adresse hinzufügen (BTC / ETH / XRP / ADA / ALGO)').click();
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
  await expect(page.getByText('+ 500,00 USDC · + 10,0000 QNT')).toBeVisible();
  await expect(page.getByRole('link', { name: /0x11A4…7886/ })).toHaveAttribute('href', /etherscan\.io\/address\/0x11A4/);

  // Bitcoin: WIF-Privatschlüssel abgewiesen, Prüfsumme geprüft, P2SH-Adresse angenommen
  await page.getByText('+ Wallet-Adresse hinzufügen (BTC / ETH / XRP / ADA / ALGO)').click();
  await addr.fill('5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/NICHT gespeichert/)).toBeVisible();
  await addr.fill('33ewns94qWVhzfPVwWTuHh5zNNTKihEKUV');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/Bitcoin-Adresse ist nicht gültig/)).toBeVisible();
  await addr.fill('33ewns94qWVhzfPVwWTuHh5zNNTKihEKUU');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/„Ledger BTC“ hinzugefügt/)).toBeVisible();
  await page.reload();
  await expect(page.getByText('0,25000000 BTC', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /33ewns…EKUU/ })).toHaveAttribute('href', /mempool\.space\/address\/33ewns/);

  // Cardano: Stake-Adresse abgewiesen, Basisadresse angenommen → ganzes Konto inkl. Belohnungen
  await page.getByText('+ Wallet-Adresse hinzufügen (BTC / ETH / XRP / ADA / ALGO)').click();
  await addr.fill('stake1uyehkck0lajq8gr28t9uxnuvgcqrc6070x3k9r8048z8y5gh6ffgw');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/Das ist eine Stake-Adresse/)).toBeVisible();
  await addr.fill('addr1q8g0rkm9x7ngfe2zuxc5puln7gwxs8ztd07gdvjqs7vnslalrc5nq60py5nfqpthepapaltcsrcf3d2ph5welardfd8sgejn8q');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/„Ledger ADA“ hinzugefügt/)).toBeVisible();
  await page.reload();
  await expect(page.getByText('1.000,00 ADA', { exact: true })).toBeVisible();
  await expect(page.getByText(/Ganzes Cardano-Konto .* 12,50 ADA Staking-Belohnungen/)).toBeVisible();

  // Algorand: Tippfehler erkannt, Adresse angenommen
  await page.getByText('+ Wallet-Adresse hinzufügen (BTC / ETH / XRP / ADA / ALGO)').click();
  await addr.fill('55DXJK2IX7HELJKDX54YPUELBUXQKXOH74GKTVU4SEK46TDGZX32L3Y5PY');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/Algorand-Adresse ist nicht gültig/)).toBeVisible();
  await addr.fill('54DXJK2IX7HELJKDX54YPUELBUXQKXOH74GKTVU4SEK46TDGZX32L3Y5PY');
  await page.getByRole('button', { name: 'Adresse hinzufügen' }).click();
  await expect(page.getByText(/„Ledger ALGO“ hinzugefügt/)).toBeVisible();
  await page.reload();
  await expect(page.getByText('500,00 ALGO', { exact: true })).toBeVisible();
  await expect(page.getByText(/\+ 100,00 USDC · Davon 0,10 ALGO als Mindestguthaben/)).toBeVisible();

  // 24-h-Veränderung (Testkurse: XRP +10 %, ETH −2 %, BTC +1 %, ADA ±0)
  const row = (c: string) => page.locator('tr', { has: page.getByRole('cell', { name: c, exact: true }) });
  await expect(row('XRP')).toContainText('+10,00 %');
  await expect(row('ETH')).toContainText('−2,00 %');
  await expect(row('ADA')).toContainText('±0,00 %');
  await expect(row('QNT')).toContainText('−3,00 %');
  // € erscheint nur mit EZB-Kurs (offline in Tests nicht verfügbar) – AED immer
  await expect(page.getByText(/^▲ \+\d+,\d{2} %( · \+[\d.]+ €)? · \+[\d.]+ AED$/).first()).toBeVisible();
});
