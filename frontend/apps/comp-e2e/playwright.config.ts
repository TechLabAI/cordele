import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for COMP e2e (M7 e2e-validate gate).
 * 2 features: configuracoes (T05) + editor-de-layout-preview (T06).
 * Registered by fe-architect-promote COMP (D-487 pattern); prototype-first (D-493/D-494).
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
