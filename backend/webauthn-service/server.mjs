import express from 'express'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'

const PORT = process.env.PORT || 8091
// Kong's public entry point (backend/supabase/docker-compose.yml), not a
// direct connection to any one backing service.
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://kong:8000'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RP_ID = process.env.RP_ID || 'localhost'
const RP_NAME = process.env.RP_NAME || 'CLUSTR Barangay OS'
// Comma-separated list — must match the exact origin(s) the app is served
// from (scheme + host + port), e.g. "https://brgy.example.gov.ph".
const ORIGINS = (process.env.WEBAUTHN_ORIGINS || 'http://localhost:8080')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

if (!SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

// ---- Supabase REST/Auth helpers ----
// Everything that must bypass RLS (reading/writing webauthn_credentials,
// resolving an email to a user id, minting a session) goes through these,
// authenticated as service_role — the direct replacement for the old
// PocketBase superuser client. service_role has RLS bypass by construction
// (see backend/supabase/verify/00_test_env.sql's `bypassrls` role, mirrored
// by the real supabase/postgres image), so no separate "admin" concept is
// needed the way PocketBase's superuser panel was.

async function restRequest(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`PostgREST ${method} ${path} failed: ${res.status} ${detail}`)
  }
  if (res.status === 204) return null
  return res.json()
}

async function authAdminRequest(path, { method = 'POST', body } = {}) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`GoTrue admin ${method} ${path} failed: ${res.status} ${JSON.stringify(json)}`)
  return json
}

// Validates a user's own bearer token against GoTrue's own /user endpoint —
// reuses GoTrue's token verification instead of reimplementing JWT
// validation here, same rationale as the PocketBase version's authRefresh
// call. Returns GoTrue's user object ({ id, email, user_metadata, ... }).
async function getUserFromToken(token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`token invalid: ${res.status}`)
  return res.json()
}

// Resolves an email to a user id without exposing auth.users through
// PostgREST (only the public schema is exposed — see docker-compose.yml's
// PGRST_DB_SCHEMAS). Backed by migrations/0027_lookup_user_by_email_rpc.sql,
// a service-role-only SECURITY DEFINER function, the same narrow-RPC
// pattern 0026_get_public_document_rpc.sql already established.
async function lookupUserIdByEmail(email) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/lookup_user_id_by_email`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_email: email }),
  })
  if (!res.ok) return null
  const id = await res.json()
  return id || null
}

// Mints a real GoTrue session for an already-passkey-verified user, with no
// password involved — the direct replacement for PocketBase's superuser
// `impersonate()` call. This is Path A from the Phase 0 spike
// (backend/supabase-spike/BUILD_NOTES.md, Unknown #2): GoTrue's admin API
// generates a one-time magiclink server-side, then the sidecar itself
// redeems it via POST /auth/v1/verify using the link's `email_otp` code
// (NOT the `action_link`/`hashed_token`, which are meant for a *browser*
// redirect and return the tokens in a URL fragment GoTrue's server never
// sees — email_otp is the one redeemable path that returns access_token +
// refresh_token directly in a JSON body, which is what a page refresh
// needs to survive). Must be checked against a real GoTrue instance before
// this is trusted in production — see backend/supabase/PHASE3_NOTES.md.
async function mintSessionForUser(email) {
  const link = await authAdminRequest('/admin/generate_link', {
    body: { type: 'magiclink', email },
  })
  const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email, token: link.email_otp }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.access_token || !json?.refresh_token) {
    throw new Error(`session mint did not return both tokens: ${res.status} ${JSON.stringify(json)}`)
  }
  return json
}

function getBearerToken(req) {
  const header = req.get('authorization') || ''
  const [scheme, token] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && token ? token : null
}

// ---- In-memory challenge store ----
// Challenges are single-use, short-lived (2 min), and only ever consumed by
// the same ceremony they were issued for. In-memory is fine for a
// single-instance sidecar; a restart mid-ceremony just means the user
// retries, which is an acceptable, rare cost for the simplicity this buys.
const CHALLENGE_TTL_MS = 2 * 60 * 1000
const challenges = new Map()

function storeChallenge(key, challenge) {
  challenges.set(key, { challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS })
}

function takeChallenge(key) {
  const entry = challenges.get(key)
  challenges.delete(key)
  if (!entry || entry.expiresAt < Date.now()) return null
  return entry.challenge
}

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of challenges) {
    if (entry.expiresAt < now) challenges.delete(key)
  }
}, 60 * 1000).unref()

const app = express()
app.use(express.json())

// Permissive CORS, matching PocketBase's own default behavior. Auth here is
// Bearer-token-only (no cookies), so reflecting any origin carries no CSRF
// risk. Needed so local dev (`npm run dev`, which talks to the backend
// cross-origin without nginx in front) works the same as it does against
// PocketBase directly; production traffic is same-origin through nginx.
app.use((req, res, next) => {
  const origin = req.get('origin')
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

// ---- Registration (requires an existing session — add a passkey from Settings) ----

app.post('/api/webauthn/register/options', async (req, res) => {
  try {
    const token = getBearerToken(req)
    if (!token) return res.status(401).json({ error: 'Missing Authorization header' })
    const user = await getUserFromToken(token)

    const existingCreds = await restRequest(`webauthn_credentials?user=eq.${user.id}&select=credential_id,transports`)

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email,
      userID: new TextEncoder().encode(user.id),
      userDisplayName: user.user_metadata?.name || user.email,
      attestationType: 'none',
      excludeCredentials: existingCreds.map((c) => ({
        id: c.credential_id,
        transports: c.transports || undefined,
      })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    })

    storeChallenge(`reg:${user.id}`, options.challenge)
    res.json(options)
  } catch (err) {
    console.error('register/options failed:', err)
    res.status(401).json({ error: 'Not authenticated' })
  }
})

app.post('/api/webauthn/register/verify', async (req, res) => {
  try {
    const token = getBearerToken(req)
    if (!token) return res.status(401).json({ error: 'Missing Authorization header' })
    const user = await getUserFromToken(token)

    const expectedChallenge = takeChallenge(`reg:${user.id}`)
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Registration session expired. Please try again.' })
    }

    const { attestationResponse, deviceName } = req.body || {}
    const verification = await verifyRegistrationResponse({
      response: attestationResponse,
      expectedChallenge,
      expectedOrigin: ORIGINS,
      expectedRPID: RP_ID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Could not verify this passkey' })
    }

    const { credential } = verification.registrationInfo
    await restRequest('webauthn_credentials', {
      method: 'POST',
      prefer: 'return=minimal',
      body: {
        user: user.id,
        credential_id: credential.id,
        public_key: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        device_name: (deviceName || '').slice(0, 100) || 'Passkey',
        transports: credential.transports || [],
      },
    })

    res.json({ verified: true })
  } catch (err) {
    console.error('register/verify failed:', err)
    res.status(400).json({ error: 'Could not verify this passkey' })
  }
})

// ---- Login (no existing session — this is the passwordless sign-in path) ----

app.post('/api/webauthn/login/options', async (req, res) => {
  try {
    const email = (req.body?.email || '').trim()
    if (!email) return res.status(400).json({ error: 'Email is required' })

    const userId = await lookupUserIdByEmail(email)
    if (!userId) return res.status(404).json({ error: 'No passkey found for this account' })

    const creds = await restRequest(`webauthn_credentials?user=eq.${userId}&select=credential_id,transports`)
    if (creds.length === 0) return res.status(404).json({ error: 'No passkey found for this account' })

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: creds.map((c) => ({ id: c.credential_id, transports: c.transports || undefined })),
      userVerification: 'preferred',
    })

    storeChallenge(`login:${email.toLowerCase()}`, options.challenge)
    res.json(options)
  } catch (err) {
    console.error('login/options failed:', err)
    res.status(500).json({ error: 'Could not start passkey sign-in' })
  }
})

app.post('/api/webauthn/login/verify', async (req, res) => {
  try {
    const email = (req.body?.email || '').trim()
    const assertionResponse = req.body?.assertionResponse
    if (!email || !assertionResponse) return res.status(400).json({ error: 'Missing email or assertion' })

    const expectedChallenge = takeChallenge(`login:${email.toLowerCase()}`)
    if (!expectedChallenge) {
      return res.status(400).json({ error: 'Sign-in session expired. Please try again.' })
    }

    const userId = await lookupUserIdByEmail(email)
    if (!userId) return res.status(404).json({ error: 'No passkey found for this account' })

    const [credRow] = await restRequest(
      `webauthn_credentials?user=eq.${userId}&credential_id=eq.${encodeURIComponent(assertionResponse.id)}`
    )
    if (!credRow) return res.status(400).json({ error: 'Unrecognized passkey' })

    const verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge,
      expectedOrigin: ORIGINS,
      expectedRPID: RP_ID,
      credential: {
        id: credRow.credential_id,
        publicKey: new Uint8Array(Buffer.from(credRow.public_key, 'base64url')),
        counter: credRow.counter,
        transports: credRow.transports || undefined,
      },
    })

    if (!verification.verified) return res.status(400).json({ error: 'Could not verify this passkey' })

    await restRequest(`webauthn_credentials?id=eq.${credRow.id}`, {
      method: 'PATCH',
      prefer: 'return=minimal',
      body: { counter: verification.authenticationInfo.newCounter },
    })

    // Mint a real GoTrue session for this user — same {access_token,
    // refresh_token, user} shape a password login returns, so the frontend
    // (Phase 5) handles it identically via supabase.auth.setSession().
    const session = await mintSessionForUser(email)
    res.json({ access_token: session.access_token, refresh_token: session.refresh_token, user: session.user })
  } catch (err) {
    console.error('login/verify failed:', err)
    res.status(400).json({ error: 'Could not verify this passkey' })
  }
})

app.get('/api/webauthn/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`webauthn-service listening on :${PORT} (rpID=${RP_ID}, origins=${ORIGINS.join(',')})`)
})
