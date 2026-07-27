import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  globalSetup: './e2e/global.setup.ts',
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:8080',
    storageState: 'playwright/.auth/user.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Demo mode (see e2e/global.setup.ts) needs no backend at all, so there's
  // no more separate CI-only orchestrator script (scripts/e2e-server.mjs,
  // removed — it used to start a real PocketBase instance) — just the Vite
  // dev server, same command everywhere. --port overrides vite.config.ts's
  // own dev port (5173) to match the baseURL below.
  webServer: [
    {
      command: 'npx vite --port 8080 --host',
      url: 'http://localhost:8080',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
})
