import { expect, Page } from '@playwright/test';
import { base32Decode, counterAt, hotp } from '../../src/lib/totp';

export function totpNow(secret: string, offsetSteps = 0): string {
  return hotp(base32Decode(secret), counterAt(Date.now()) + BigInt(offsetSteps));
}

/** Neues Konto + Authenticator einrichten. Gibt das TOTP-Geheimnis zurück. */
export async function signUpWithMfa(page: Page, email: string, password = 'Test-Passwort-123!'): Promise<string> {
  await page.goto('/anmelden?neu=1');
  await page.getByLabel('E-Mail').fill(email);
  await page.getByLabel('Passwort (mind. 12 Zeichen)').fill(password);
  await page.getByLabel('Passwort wiederholen').fill(password);
  await page.getByRole('button', { name: 'Konto anlegen' }).click();
  await expect(page.getByRole('heading', { name: 'Authenticator verbinden' })).toBeVisible();
  const secret = (await page.getByTestId('totp-secret').getAttribute('data-secret'))!;
  await page.getByLabel('6-stelliger Code').fill(totpNow(secret));
  await page.getByRole('button', { name: 'Einrichten abschließen' }).click();
  return secret;
}

export async function finishOnboarding(page: Page, name: string, demo: boolean) {
  await expect(page.getByRole('heading', { name: 'Hallo! Ich bin Jarvis.' })).toBeVisible();
  await page.getByLabel('Wie soll ich dich nennen?').fill(name);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Wann ziehst du um?' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Wann soll ich still sein?' })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Womit starten?' })).toBeVisible();
  await page.getByLabel(demo ? /Mit Beispielen/ : /Leer/).check();
  await page.getByRole('button', { name: 'Los geht’s' }).click();
  await expect(page.getByText('▸ Nächster Schritt').or(page.getByText('Alles im Griff.'))).toBeVisible();
}

export const uniqueEmail = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.invalid`;
