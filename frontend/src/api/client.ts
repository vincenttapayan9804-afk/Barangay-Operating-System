import PocketBase from 'pocketbase'
import { getApiUrl, isFallbackMode, setFallbackMode, checkApiReachable } from '@/lib/apiConfig'

let client: PocketBase | null = null

export function getClient(): PocketBase {
  if (!client) {
    client = new PocketBase(getApiUrl())
    client.autoCancellation(false)
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
