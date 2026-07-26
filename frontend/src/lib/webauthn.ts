import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { getApiUrl } from './apiConfig'
import { getSupabase } from './supabaseClient'

export { browserSupportsWebAuthn }

// Not available in demo mode (see lib/demoAccounts.ts) — there's no
// WebAuthn sidecar or real session to run this against, and every call
// site already gates on browserSupportsWebAuthn() + !isDemoModeEnabled()
// before reaching here (see auth/LoginPage.tsx, features/settings/
// PasskeySettings.tsx), so this file doesn't need its own demo branch.

async function webauthnFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Passkey request failed')
  return data
}

// Registers a new passkey for the currently signed-in user (e.g. from
// Settings). Requires an active session — this adds a passkey, it doesn't
// replace the sign-in flow used to get here.
export async function registerPasskey(deviceName?: string): Promise<void> {
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('You must be signed in to add a passkey')

  const optionsJSON = await webauthnFetch('/api/webauthn/register/options', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  const attestationResponse = await startRegistration({ optionsJSON })

  await webauthnFetch('/api/webauthn/register/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ attestationResponse, deviceName }),
  })
}

// Passwordless sign-in with a previously registered passkey. On success,
// adopts the session the sidecar minted (see backend/webauthn-service) the
// same way a normal password login would.
export async function loginWithPasskey(email: string): Promise<void> {
  const optionsJSON = await webauthnFetch('/api/webauthn/login/options', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

  const assertionResponse = await startAuthentication({ optionsJSON })

  const { access_token, refresh_token } = await webauthnFetch('/api/webauthn/login/verify', {
    method: 'POST',
    body: JSON.stringify({ email, assertionResponse }),
  })

  const { error } = await getSupabase().auth.setSession({ access_token, refresh_token })
  if (error) throw error
}
