import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for PUB e2e (A5 e2e-validate gate).
 * 2 features / 26 scenarios from the module e2e contracts.
 * Registered by fe-nx-register-module.py (D-487); prototype-first (D-484).
 *
 * webServer: starts cordele-web on port 4299 before the test suite.
 * Using 4299 (not 4200) to avoid conflict with other dev servers that may
 * occupy 4200 in the same machine.
 * APP_URL can override the default to point to an already-running instance.
 *
 * reuseExistingServer: true in development (don't fail if 4299 is already up),
 * false in CI (always start a fresh server).
 */

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:4299';

export default defineConfig({
  testDir: './src',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  webServer: {
    // Start cordele-web on port 4299 before the test suite runs.
    // --port 4299 avoids clashing with any other dev server at 4200.
    command: 'npx nx serve cordele-web --port 4299',
    url: APP_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  use: {
    baseURL: APP_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
