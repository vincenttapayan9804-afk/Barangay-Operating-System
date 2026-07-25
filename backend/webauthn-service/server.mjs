import express from 'express'
import PocketBase from 'pocketbase'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'

const PORT = process.env.PORT || 8091
const PB_URL = process.env.PB_URL || 'http://pocketbase:8090'
const PB_SUPERUSER_EMAIL = process.env.PB_SUPERUSER_EMAIL
const PB_SUPERUSER_PASSWORD = process.env.PB_SUPERUSER_PASSWORD
const RP_ID = process.env.RP_ID || 'localhost'
const RP_NAME = process.env.RP_NAME || 'CLUSTR Barangay OS'
// Comma-separated list — must match the exact origin(s) the app is served
// from (scheme + host + port), e.g. "https://brgy.example.gov.ph".
const ORIGINS = (process.env.WEBAUTHN_ORIGINS || 'http://localhost:8080')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

if (!PB_SUPERUSER_EMAIL || !PB_SUPERUSER_PASSWORD) {
  console.error('FATAL: PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD must be set.')
  process.exit(1)
}

// ---- Superuser client (service account) ----
// Used for every operation that must bypass per-user API rules: reading a
// user by email to start a login ceremony, writing/reading credential rows,
// and impersonating a user to mint a real session token after a verified
// assertion. Cached and re-authenticated lazily on expiry.
let adminClient = null
let adminAuthPromise = null

async function getAdminClient() {
  if (adminClient?.authStore.isValid) return adminClient
  if (!adminAuthPromise) {
    adminAuthPromise = (async () => {
      const client = new PocketBase(PB_URL)
      await client.collection('_superusers').authWithPassword(PB_SUPERUSER_EMAIL, PB_SUPERUSER_PASSWORD)
      adminClient = client
      adminAuthPromise = null
      return client
    })()
  }
  return adminAuthPromise
}

// Validates a user's own bearer token by handing it to PocketBase's own
// auth-refresh endpoint — reuses PocketBase's token verification instead of
// re-implementing JWT validation here, and returns the fresh user record.
async function getUserFromToken(token) {
  const client = new PocketBase(PB_URL)
  client.authStore.save(token, null)
  await client.collection('users').authRefresh()
  return client.authStore.record
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

    const admin = await getAdminClient()
    const existingCreds = await admin.collection('webauthn_credentials').getFullList({
      filter: admin.filter('user = {:u}', { u: user.id }),
    })

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email,
      userID: new TextEncoder().encode(user.id),
      userDisplayName: user.name || user.email,
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
    const admin = await getAdminClient()
    await admin.collection('webauthn_credentials').create({
      user: user.id,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      device_name: (deviceName || '').slice(0, 100) || 'Passkey',
      transports: credential.transports || [],
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

    const admin = await getAdminClient()
    const user = await admin
      .collection('users')
      .getFirstListItem(admin.filter('email = {:e}', { e: email }))
      .catch(() => null)
    if (!user) return res.status(404).json({ error: 'No passkey found for this account' })

    const creds = await admin.collection('webauthn_credentials').getFullList({
      filter: admin.filter('user = {:u}', { u: user.id }),
    })
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

    const admin = await getAdminClient()
    const user = await admin
      .collection('users')
      .getFirstListItem(admin.filter('email = {:e}', { e: email }))
      .catch(() => null)
    if (!user) return res.status(404).json({ error: 'No passkey found for this account' })

    const credRow = await admin
      .collection('webauthn_credentials')
      .getFirstListItem(admin.filter('user = {:u} && credential_id = {:c}', { u: user.id, c: assertionResponse.id }))
      .catch(() => null)
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

    await admin.collection('webauthn_credentials').update(credRow.id, {
      counter: verification.authenticationInfo.newCounter,
    })

    // Mint a real PocketBase session for this user — same {token, record}
    // shape authWithPassword() returns, so the frontend handles it identically.
    const impersonated = await admin.collection('users').impersonate(user.id, 60 * 60 * 24 * 7)
    res.json({ token: impersonated.authStore.token, record: impersonated.authStore.record })
  } catch (err) {
    console.error('login/verify failed:', err)
    res.status(400).json({ error: 'Could not verify this passkey' })
  }
})

app.get('/api/webauthn/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, () => {
  console.log(`webauthn-service listening on :${PORT} (rpID=${RP_ID}, origins=${ORIGINS.join(',')})`)
})
