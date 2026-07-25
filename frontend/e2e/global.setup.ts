import { chromium, type FullConfig } from '@playwright/test'
import PocketBase from 'pocketbase'

const AUTH_FILE = 'playwright/.auth/user.json'

async function ensureTestUser(pb: PocketBase) {
  const email = process.env.E2E_USER_EMAIL ?? 'test@barangay.gov.ph'
  const password = process.env.E2E_USER_PASSWORD ?? 'Test1234!'

  try {
    await pb.collection('users').authWithPassword(email, password)
    return { email, password }
  } catch {
    if (!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD) {
      console.warn('No E2E_ADMIN_EMAIL/PASSWORD set and test user does not exist. Tests will fail at login.')
      return { email, password }
    }
    await pb.admins.authWithPassword(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD)
    await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name: 'Test User',
      role: 'admin',
    })
    return { email, password }
  }
}

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:8080'
  const apiURL = process.env.E2E_API_URL ?? 'http://127.0.0.1:8090'

  const pb = new PocketBase(apiURL)
  const { email, password } = await ensureTestUser(pb)

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(`${baseURL}/login`)
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/')
  await page.context().storageState({ path: AUTH_FILE })
  await browser.close()
}

export default globalSetup
