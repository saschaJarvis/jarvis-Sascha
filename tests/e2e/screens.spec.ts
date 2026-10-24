import { test, expect } from '@playwright/test';
import { finishOnboarding, signUpWithMfa, uniqueEmail } from './helpers';

// Erzeugt Bildschirmfotos für die Doku (docs/screens). Nur mit SCREENS=1.
test.skip(!process.env.SCREENS, 'nur mit SCREENS=1');

test('Bildschirmfotos', async ({ page }) => {
  const shot = (n: string) => page.screenshot({ path: `docs/screens/${n}.png`, fullPage: true });
  await signUpWithMfa(page, uniqueEmail('screens'));
  await finishOnboarding(page, 'Sascha', true);
  await shot('1-heute');
  await page.goto('/aufgaben');
  await page.getByRole('link', { name: /Büromietvertrag Mainz – Kündigung/ }).click();
  await page.waitForURL(/\/aufgaben\/[0-9a-f-]{36}$/);
  await shot('2-aufgabe');
  await page.goto('/leben/vertraege');
  await page.getByRole('link', { name: /Büromietvertrag Mainz/ }).click();
  await page.getByRole('button', { name: 'Kündigung vorbereiten' }).click();
  await page.getByLabel('Dein Name').fill('Sascha Lueck');
  await page.getByRole('button', { name: 'Entwurf erstellen' }).click();
  await page.getByRole('button', { name: 'Zur Freigabe' }).click();
  await expect(page.getByText('Letzte Ansicht vor der Freigabe')).toBeVisible();
  await shot('3-kuendigung-freigabe');
  await page.goto('/heute/ruhig');
  await shot('4-ueberfordert');
  await page.goto('/leben/dubai');
  await shot('5-dubai');
});
