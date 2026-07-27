import { chromium, type FullConfig } from '@playwright/test'

const AUTH_FILE = 'playwright/.auth/user.json'

// Logs in through demo mode (see lib/demoAccounts.ts / api/mockPocketBase.ts)
// instead of a real backend — demo mode runs entirely in the browser
// (localStorage), so this needs no Postgres/GoTrue/PostgREST stack running,
// and sidesteps the `role=admin` MFA enrollment a real backend login would
// require (app.mfa_satisfied() in backend/supabase/migrations/0000_auth_helpers.sql).
// Previously this authenticated against a real, separately-started
// PocketBase instance (scripts/e2e-server.mjs) — ported to demo mode since
// these UI tests only need *some* authenticated session to reach the
// dashboard, not real backend behavior; backend/scripts/test-tenant-isolation.mjs
// is what actually exercises the real backend/RLS.
async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:8080'

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${baseURL}/login`)
  await page.getByTestId('demo-login-admin').click()
  await page.waitForURL('**/dashboard', { timeout: 30000 })
  await page.context().storageState({ path: AUTH_FILE })
  await browser.close()
}

export default globalSetup
