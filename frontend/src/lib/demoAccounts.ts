// Temporary, fully client-side demo mode — lets anyone explore the whole
// CLUSTR system in a browser with zero backend deployment. Everything lives
// in this browser's localStorage only; nothing here ever touches a real
// PocketBase server or another visitor's data. See api/mockPocketBase.ts for
// the mock backend this powers.

export type DemoRole = 'admin' | 'staff' | 'viewer'

export interface DemoAccount {
  role: DemoRole
  email: string
  password: string
  name: string
  title: string
  description: string
}

export const DEMO_BARANGAY_ID = 'demo_barangay_poblacion'

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'admin',
    email: 'admin.demo@clustr.ph',
    password: 'ClustrDemo123!',
    name: 'Capt. Rosario Dela Cruz',
    title: 'Barangay Admin',
    description: 'Full access — settings, finance, user & tenant management.',
  },
  {
    role: 'staff',
    email: 'staff.demo@clustr.ph',
    password: 'ClustrDemo123!',
    name: 'Kgd. Miguel Santos',
    title: 'Barangay Staff',
    description: 'Day-to-day operations — residents, documents, blotter, finance entry.',
  },
  {
    role: 'viewer',
    email: 'viewer.demo@clustr.ph',
    password: 'ClustrDemo123!',
    name: 'Tanod Ana Reyes',
    title: 'Read-Only Viewer',
    description: 'Browse records and reports without making changes.',
  },
]

const MODE_KEY = 'clustr_demo_mode_v1'
const DB_KEY = 'clustr_demo_db_v1'
const AUTH_KEY = 'clustr_demo_auth_v1'
const SEEDED_KEY = 'clustr_demo_seeded_v1'

export function isDemoModeEnabled(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY) === 'true'
}

export function enableDemoMode(): void {
  localStorage.setItem(MODE_KEY, 'true')
}

/** Clears all demo state (data, session, seed flag) and turns demo mode off. */
export function exitDemoMode(): void {
  localStorage.removeItem(MODE_KEY)
  localStorage.removeItem(DB_KEY)
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(SEEDED_KEY)
}

export function isDemoSeeded(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(SEEDED_KEY) === 'true'
}

export function markDemoSeeded(): void {
  localStorage.setItem(SEEDED_KEY, 'true')
}
