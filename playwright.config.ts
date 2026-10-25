import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
    ...devices['iPhone 13'],
    browserName: 'chromium',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npx next start -p 3100',
    url: 'http://localhost:3100/anmelden',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { ALLOW_SIGNUP: 'true', AUTH_PROVIDER: 'local', CLAUDE_FAKE: '1', CALENDAR_FAKE: '1', NEWS_FAKE: '1', CRYPTO_FAKE: '1' },
  },
});
