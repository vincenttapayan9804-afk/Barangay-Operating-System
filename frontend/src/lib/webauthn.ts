import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'
import { getApiUrl } from './apiConfig'
import { getClient } from '@/api/client'

export { browserSupportsWebAuthn }

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
  const token = getClient().authStore.token
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
// saves the resulting session the same way a normal password login would.
export async function loginWithPasskey(email: string): Promise<void> {
  const optionsJSON = await webauthnFetch('/api/webauthn/login/options', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

  const assertionResponse = await startAuthentication({ optionsJSON })

  const { token, record } = await webauthnFetch('/api/webauthn/login/verify', {
    method: 'POST',
    body: JSON.stringify({ email, assertionResponse }),
  })

  getClient().authStore.save(token, record)
}
