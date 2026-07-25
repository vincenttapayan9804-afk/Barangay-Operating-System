import PocketBase from 'pocketbase'
import { getApiUrl, isFallbackMode, setFallbackMode, checkApiReachable } from '@/lib/apiConfig'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { createMockClient } from './mockPocketBase'

let client: PocketBase | null = null
let mockClient: PocketBase | null = null

export function getClient(): PocketBase {
  if (isDemoModeEnabled()) {
    if (!mockClient) mockClient = createMockClient() as unknown as PocketBase
    return mockClient
  }

  if (!client) {
    client = new PocketBase(getApiUrl())
    client.autoCancellation(false)

    // Stamp every new record with the logged-in user's own barangay_id so
    // callers don't need to pass it explicitly — PocketBase's API rules are
    // what actually enforce tenant isolation server-side; this just makes
    // creates satisfy those rules without touching every api/*.ts file.
    client.beforeSend = (url, options) => {
      if (
        options.method === 'POST' &&
        url.endsWith('/records') &&
        options.body &&
        typeof options.body === 'object'
      ) {
        const barangayId = client!.authStore.record?.barangay_id
        const body = options.body as Record<string, unknown>
        if (barangayId && !body.barangay_id) {
          body.barangay_id = barangayId
        }
      }
      return { url, options }
    }
  }
  return client
}

let reachabilityChecked = false

export async function ensureReachability(): Promise<boolean> {
  if (reachabilityChecked && !isFallbackMode()) return true

  const reachable = await checkApiReachable()
  setFallbackMode(!reachable)
  reachabilityChecked = true
  return reachable
}

export function resetReachabilityCheck(): void {
  reachabilityChecked = false
}
