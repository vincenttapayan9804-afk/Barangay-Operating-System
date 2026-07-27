// The primary (tunnel) URL — always available if internet works.
const PUBLIC_URL = import.meta.env.VITE_API_URL ?? ''

// Optional local LAN address (e.g., http://192.168.0.100:8000 — Kong's gateway port).
// Set VITE_LOCAL_API_URL in .env.production if you want local-lan fallback.
const LOCAL_URL = import.meta.env.VITE_LOCAL_API_URL ?? ''

// Resolved base URL the rest of the app should use
let resolvedUrl: string = PUBLIC_URL
let fallbackMode = false

export function getApiUrl(): string {
  return resolvedUrl || PUBLIC_URL || '/'
}

export function isFallbackMode(): boolean {
  return fallbackMode
}

export function setFallbackMode(v: boolean): void {
  fallbackMode = v
}

export async function resolveApiUrl(): Promise<string> {
  // Local dev — use PUBLIC_URL as-is (usually localhost:8000, Kong's gateway)
  if (!LOCAL_URL) {
    resolvedUrl = PUBLIC_URL
    return resolvedUrl
  }

  // Page loaded over HTTPS (tunnel) — skip HTTP local fallback entirely.
  // Browsers block HTTPS→HTTP requests (mixed content), so the login POST
  // would be silently rejected.
  if (window.location.protocol === 'https:') {
    resolvedUrl = PUBLIC_URL
    return PUBLIC_URL
  }

  // Page is HTTP — try local LAN first, fall back to tunnel
  try {
    // GoTrue's own /health (routed, but not key-auth-gated by Kong's
    // auth-v1-open* routes — see backend/supabase/kong.yml) — any response
    // at all, even a 401 from a route that IS key-auth-gated, confirms the
    // gateway is actually reachable, which is all this check needs to know.
    const res = await fetch(`${LOCAL_URL}/auth/v1/health`, {
      signal: AbortSignal.timeout(3000),
    })
    if (res.status) {
      resolvedUrl = LOCAL_URL
      setFallbackMode(false)
      return LOCAL_URL
    }
  } catch {
    // local unreachable — use tunnel
  }

  resolvedUrl = PUBLIC_URL
  return PUBLIC_URL
}

export async function checkApiReachable(): Promise<boolean> {
  try {
    // Same "any response counts" reasoning as resolveApiUrl() above — this
    // only needs to know the gateway answers at all, not whether this
    // particular unauthenticated request is itself allowed.
    await fetch(`${getApiUrl()}/auth/v1/health`, {
      signal: AbortSignal.timeout(5000),
    })
    return true
  } catch {
    return false
  }
}
