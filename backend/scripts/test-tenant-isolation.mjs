#!/usr/bin/env node
// Automated multi-tenant isolation check.
//
// Spins up against a running PocketBase instance (started separately by the
// caller — see .github/workflows/ci.yml), creates two fake barangay tenants
// with their own admin users, and asserts the core security property added
// in 1785000027_multi_tenant_barangays.js: tenant A can never read, list, or
// spoof-create data belonging to tenant B. This turns the manual curl-based
// verification used to design that migration into a repeatable regression
// check, so a future rule change that reintroduces a leak fails CI instead
// of shipping.
//
// Usage: PB_URL=http://127.0.0.1:8090 node scripts/test-tenant-isolation.mjs

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const SUPERUSER_EMAIL = process.env.PB_SUPERUSER_EMAIL || 'admin@e2e.local'
const SUPERUSER_PASSWORD = process.env.PB_SUPERUSER_PASSWORD || 'E2eAdmin123!'

let failures = 0

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok - ${label}`)
  } else {
    failures++
    console.error(`  FAIL - ${label}${detail ? `\n         ${detail}` : ''}`)
  }
}

async function req(method, path, { body, token } = {}) {
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    // no body
  }
  return { status: res.status, json }
}

function householdPayload(barangayId, householdNumber) {
  return {
    household_number: householdNumber,
    region: 'Region I',
    province: 'Test Province',
    city_municipality: 'Test City',
    barangay: 'Test Barangay',
    household_complete_address: '123 Test St',
    household_type: 'Nuclear Family',
    tenure_status: 'Owner',
    household_unit: 'Single House',
    data_set: 'BIPS',
    barangay_id: barangayId,
  }
}

async function main() {
  console.log(`Tenant isolation check against ${PB_URL}`)

  // 1. Superuser auth (bypasses all API rules — used only to seed fixtures).
  const su = await req('POST', '/api/collections/_superusers/auth-with-password', {
    body: { identity: SUPERUSER_EMAIL, password: SUPERUSER_PASSWORD },
  })
  check('superuser auth succeeds', su.status === 200, `status=${su.status} ${JSON.stringify(su.json)}`)
  if (su.status !== 200) return finish()
  const suToken = su.json.token

  // 2. Seed two tenants.
  const barangayA = await req('POST', '/api/collections/barangays/records', {
    token: suToken,
    body: { name: `Tenant A ${Date.now()}`, active: true },
  })
  const barangayB = await req('POST', '/api/collections/barangays/records', {
    token: suToken,
    body: { name: `Tenant B ${Date.now()}`, active: true },
  })
  check('barangay A created', barangayA.status === 200, JSON.stringify(barangayA.json))
  check('barangay B created', barangayB.status === 200, JSON.stringify(barangayB.json))
  if (barangayA.status !== 200 || barangayB.status !== 200) return finish()
  const idA = barangayA.json.id
  const idB = barangayB.json.id

  // 3. Seed one staff user per tenant. Using "staff" (not "admin") here
  // deliberately sidesteps the MFA requirement added in
  // 1785000029_admin_mfa.js — that's a separate, already-verified concern
  // (see the manual MFA check performed while building that migration);
  // this script is only about tenant data isolation, and staff already
  // satisfies every create rule exercised below.
  const stamp = Date.now()
  const userA = await req('POST', '/api/collections/users/records', {
    token: suToken,
    body: {
      email: `staff-a-${stamp}@example.com`,
      password: 'TestPass123!',
      passwordConfirm: 'TestPass123!',
      role: 'staff',
      barangay_id: idA,
      verified: true,
    },
  })
  const userB = await req('POST', '/api/collections/users/records', {
    token: suToken,
    body: {
      email: `staff-b-${stamp}@example.com`,
      password: 'TestPass123!',
      passwordConfirm: 'TestPass123!',
      role: 'staff',
      barangay_id: idB,
      verified: true,
    },
  })
  check('user A created', userA.status === 200, JSON.stringify(userA.json))
  check('user B created', userB.status === 200, JSON.stringify(userB.json))
  if (userA.status !== 200 || userB.status !== 200) return finish()

  // 4. Sign in as each tenant's own staff user (no more superuser from here
  // on — everything below goes through the same rules a real user hits).
  const authA = await req('POST', '/api/collections/users/auth-with-password', {
    body: { identity: userA.json.email, password: 'TestPass123!' },
  })
  const authB = await req('POST', '/api/collections/users/auth-with-password', {
    body: { identity: userB.json.email, password: 'TestPass123!' },
  })
  check('tenant A user login succeeds', authA.status === 200)
  check('tenant B user login succeeds', authB.status === 200)
  if (authA.status !== 200 || authB.status !== 200) return finish()
  const tokenA = authA.json.token
  const tokenB = authB.json.token

  // 5. Tenant A can create its own data.
  const householdA = await req('POST', '/api/collections/households/records', {
    token: tokenA,
    body: householdPayload(idA, `A-${stamp}`),
  })
  check('tenant A can create its own household', householdA.status === 200, JSON.stringify(householdA.json))

  // 6. Tenant A cannot spoof-create data under tenant B's barangay_id.
  const spoofed = await req('POST', '/api/collections/households/records', {
    token: tokenA,
    body: householdPayload(idB, `SPOOF-${stamp}`),
  })
  check('tenant A cannot spoof-create under tenant B', spoofed.status === 400, `status=${spoofed.status}`)

  // 7. Tenant B creates its own household so there is something to leak.
  const householdB = await req('POST', '/api/collections/households/records', {
    token: tokenB,
    body: householdPayload(idB, `B-${stamp}`),
  })
  check('tenant B can create its own household', householdB.status === 200, JSON.stringify(householdB.json))
  if (householdA.status !== 200 || householdB.status !== 200) return finish()

  // 8. Tenant A's list never contains tenant B's rows.
  const listA = await req('GET', '/api/collections/households/records?perPage=200', { token: tokenA })
  const leaked = (listA.json?.items || []).some((r) => r.id === householdB.json.id)
  check('tenant A list excludes tenant B records', listA.status === 200 && !leaked, `leaked=${leaked}`)

  // 9. Tenant A cannot view tenant B's record directly by id (no existence leak).
  const viewCross = await req('GET', `/api/collections/households/records/${householdB.json.id}`, { token: tokenA })
  check('tenant A cannot view tenant B record by id', viewCross.status === 404, `status=${viewCross.status}`)

  // 10. barangays collection itself: each admin only sees their own tenant row.
  const barangayListA = await req('GET', '/api/collections/barangays/records?perPage=200', { token: tokenA })
  const onlyOwn =
    barangayListA.status === 200 &&
    barangayListA.json.items.length === 1 &&
    barangayListA.json.items[0].id === idA
  check('tenant A sees only its own barangay row', onlyOwn, JSON.stringify(barangayListA.json?.items))

  // 11. system_settings: same key allowed in both tenants (composite unique
  // index is scoped by barangay_id, not global) and not visible cross-tenant.
  // (system_settings.createRule is admin-only; created via superuser here
  // since this check is about the DB-level index, not create-time RBAC —
  // reads below still go through the real tenant-scoped listRule.)
  const settingA = await req('POST', '/api/collections/system_settings/records', {
    token: suToken,
    body: { key: 'org_name', value: 'Tenant A Hall', barangay_id: idA },
  })
  const settingB = await req('POST', '/api/collections/system_settings/records', {
    token: suToken,
    body: { key: 'org_name', value: 'Tenant B Hall', barangay_id: idB },
  })
  check('tenant A can create system_settings key "org_name"', settingA.status === 200, JSON.stringify(settingA.json))
  check(
    'tenant B can create the same key "org_name" (index scoped per-tenant)',
    settingB.status === 200,
    JSON.stringify(settingB.json),
  )

  const settingsListA = await req('GET', '/api/collections/system_settings/records?perPage=200', { token: tokenA })
  const settingsLeaked = settingB.json?.id
    ? (settingsListA.json?.items || []).some((r) => r.id === settingB.json.id)
    : false
  check('tenant A settings list excludes tenant B settings', settingsListA.status === 200 && !settingsLeaked)

  return finish()
}

function finish() {
  console.log('')
  if (failures > 0) {
    console.error(`${failures} isolation check(s) failed.`)
    process.exit(1)
  }
  console.log('All tenant isolation checks passed.')
}

main().catch((err) => {
  console.error('Unexpected error running isolation checks:', err)
  process.exit(1)
})
