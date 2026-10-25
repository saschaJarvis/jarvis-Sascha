import { test, expect } from '@playwright/test';
import { finishOnboarding, signUpWithMfa, uniqueEmail } from './helpers';

// NEWS_FAKE=1 (nur lokale Anmeldung): Test-Feeds statt echter Abrufe.
test('News: Werder Bremen mit allen Quellen, Filter je Quelle, Links öffnen extern', async ({ page }) => {
  await signUpWithMfa(page, uniqueEmail('news'));
  await finishOnboarding(page, 'Sascha', false);
  await page.getByRole('link', { name: 'News' }).first().click();
  await expect(page.getByRole('heading', { name: 'Werder Bremen' })).toBeVisible();
  for (const n of ['kicker', 'Transfermarkt', 'BILD', 'SPORT BILD', 'YouTube']) {
    await expect(page.getByRole('navigation', { name: 'Quellen' }).getByRole('link', { name: new RegExp(`^${n} \\d`) })).toBeVisible();
  }
  await expect(page.getByText('Test-Schlagzeile kicker: Werder gewinnt')).toBeVisible();
  await expect(page.getByText('Testvideo: Training am Osterdeich')).toBeVisible();
  const first = page.locator('main ul a').first();
  await expect(first).toHaveAttribute('target', '_blank');
  await expect(first).toHaveAttribute('rel', /noopener/);
  // Filter: nur YouTube
  await page.getByRole('navigation', { name: 'Quellen' }).getByRole('link', { name: /^YouTube/ }).click();
  await expect(page.getByText('Testvideo: Training am Osterdeich')).toBeVisible();
  await expect(page.getByText('Test-Schlagzeile kicker: Werder gewinnt')).toHaveCount(0);
  // Logos kommen über Jarvis selbst
  const logo = await page.request.get('/api/logo/kicker');
  expect(logo.ok()).toBeTruthy();
  expect(logo.headers()['content-type']).toMatch(/^image\//);
  expect((await page.request.get('/api/logo/evil')).status()).toBe(404);
  await page.goto('/news');
  await page.screenshot({ path: 'docs/screens/6-news.png', fullPage: false });
});
