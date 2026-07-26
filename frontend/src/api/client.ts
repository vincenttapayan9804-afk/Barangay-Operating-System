import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { createMockClient, type MockClient } from './mockPocketBase'

let mockClient: MockClient | null = null

/**
 * Demo mode's fake, localStorage-backed backend (see mockPocketBase.ts) —
 * the only consumer of this client from Phase 5 onward. The real backend is
 * @supabase/supabase-js (see lib/supabaseClient.ts's getSupabase()); every
 * api/*.ts helper branches on isDemoModeEnabled() to pick between the two.
 * Throws outside demo mode so a missed branch fails loudly instead of
 * silently reading/writing fake local data.
 */
export function getClient(): MockClient {
  if (!isDemoModeEnabled()) {
    throw new Error('getClient() is demo-mode only — use getSupabase() for the real backend')
  }
  if (!mockClient) mockClient = createMockClient()
  return mockClient
}

// mockPocketBase.ts's `collection('users')` return type is a runtime-only
// distinction (TypeScript sees the union of its two possible shapes
// regardless of the string passed in) — this narrows it for the one caller
// that needs the auth-only methods (auth/session.ts), without touching
// mockPocketBase.ts itself.
export interface MockUsersCollection {
  authWithPassword(email: string, password: string): Promise<{ token: string; record: Record<string, unknown> }>
  authRefresh(): Promise<{ token: string; record: Record<string, unknown> }>
}

export function getMockUsersCollection(): MockUsersCollection {
  return getClient().collection('users') as unknown as MockUsersCollection
}
