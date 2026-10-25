import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { finishOnboarding, signUpWithMfa, uniqueEmail } from './helpers';

const dbUrl = () => process.env.DATABASE_URL ?? /DATABASE_URL=(.+)/.exec(readFileSync('.env.local', 'utf8'))?.[1]?.trim();

// Wiederkehrende Zahlung → monatliche Aufgabe im Kalender, abhakbar und wieder zu öffnen.
test('Lager-Rechnung: erscheint im Kalender am Monatsletzten und lässt sich abhaken', async ({ page }) => {
  const email = uniqueEmail('bill');
  await signUpWithMfa(page, email);
  await finishOnboarding(page, 'Sascha', false);

  const c = new Client({ connectionString: dbUrl() });
  await c.connect();
  await c.query(`insert into recurring_bills (user_id, title, amount_minor, currency, day_of_month, payee_match)
                 select id, 'Lager Dubai bezahlen (StoreIT B042)', 105000, 'AED', -1, 'storeit' from auth.users where email = $1`, [email]);
  await c.end();

  await page.goto('/kalender');
  const item = page.getByRole('tabpanel').getByText(/Lager Dubai bezahlen \(StoreIT B042\) – /);
  // Zum Monatsletzten blättern (höchstens ~6 Wochen)
  const findItem = async () => {
    for (let w = 0; w < 6; w++) {
      for (const t of await page.getByRole('tab').all()) { await t.click(); if (await item.count()) return; }
      await page.getByRole('button', { name: 'Nächste Woche' }).click();
    }
  };
  await findItem();
  await expect(item.first()).toBeVisible();

  const box = page.getByRole('button', { name: /abhaken/ }).first();
  await box.click();
  await expect(page.getByRole('button', { name: /wieder öffnen/ }).first()).toBeVisible();
  await page.reload();
  await findItem();
  await expect(page.getByRole('tabpanel').getByText('✓ erledigt').first()).toBeVisible();

  // Idempotent: erneutes Laden legt keine zweite Aufgabe für denselben Monat an
  const c2 = new Client({ connectionString: dbUrl() });
  await c2.connect();
  const r = await c2.query(`select count(*)::int n, count(distinct idempotency_key)::int k from tasks t join auth.users u on u.id = t.user_id
                            where u.email = $1 and t.idempotency_key like 'bill:%'`, [email]);
  await c2.end();
  expect(r.rows[0].n).toBe(2);
  expect(r.rows[0].k).toBe(2);
});
