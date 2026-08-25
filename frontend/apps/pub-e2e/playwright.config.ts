import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for PUB e2e (A5 e2e-validate gate).
 * 2 features / 26 scenarios from the module e2e contracts.
 * Registered by fe-nx-register-module.py (D-487); prototype-first (D-484).
 */
export default defineConfig({
  testDir: './src',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env['APP_URL'] ?? 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
