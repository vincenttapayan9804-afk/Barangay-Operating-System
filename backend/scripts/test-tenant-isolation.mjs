#!/usr/bin/env node
// Automated multi-tenant isolation check — Supabase/Postgres port of the
// PocketBase-era version. Talks directly to GoTrue (`auth`) and PostgREST
// (`rest`), the same "start Postgres/GoTrue/PostgREST" scope the migration
// plan's Phase 7 section calls for — Kong is deliberately NOT in the loop
// here. `apikey` enforcement (anon/service_role consumer groups) lives
// entirely in Kong's key-auth plugin (kong.yml); GoTrue and PostgREST
// themselves only ever look at the `Authorization: Bearer <jwt>` header and
// the `role` claim inside it, so a plain `SERVICE_ROLE_KEY`/user access
// token is all either service needs when reached directly on its own port
// (same bypass scripts/healthcheck.sh and the deploy scripts already use to
// avoid Kong's apikey requirement turning a healthy backend into a false
// "unhealthy" 401/403).
//
// Creates two fake barangay tenants (via SERVICE_ROLE_KEY, which carries
// Postgres's `service_role`, a BYPASSRLS role — the direct analogue of the
// old PocketBase superuser token used only to seed fixtures) with their own
// staff admin users, and asserts the core security property added by
// 0001_barangays.sql/0005_households.sql's RLS policies: tenant A can never
// read, list, or spoof-create data belonging to tenant B.
//
// Two assertions changed shape from the PocketBase version, both because
// PostgREST is a query-shaped API, not a REST-per-record one like
// PocketBase:
//   - Spoofed insert: PocketBase's API rule violation was HTTP 400. A
//     Postgres RLS policy violation is a distinct error class — PostgREST
//     surfaces it as HTTP 403 with Postgres error code 42501
//     ("insufficient_privilege" / row-level security policy violation).
//   - Cross-tenant view-by-id: PocketBase has a discrete
//     `/records/{id}` endpoint that 404s when the row is filtered out by a
//     view rule. PostgREST has no separate single-record endpoint — a
//     filtered `?id=eq.<id>` query that RLS excludes just returns HTTP 200
//     with an empty array, same as the list-exclusion check. There is no
//     "existence leak" HTTP status to assert on some 4 REST fetches;
//     zero-rows-returned *is* the non-leak property here.
//
// Usage:
//   AUTH_URL=http://127.0.0.1:9999 REST_URL=http://127.0.0.1:3001 \
//   SERVICE_ROLE_KEY=... node scripts/test-tenant-isolation.mjs

const AUTH_URL = process.env.AUTH_URL || 'http://127.0.0.1:9999'
const REST_URL = process.env.REST_URL || 'http://127.0.0.1:3001'
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('SERVICE_ROLE_KEY is required (see this script\'s header comment for usage).')
  process.exit(1)
}

let failures = 0

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok - ${label}`)
  } else {
    failures++
    console.error(`  FAIL - ${label}${detail ? `\n         ${detail}` : ''}`)
  }
}

async function req(base, method, path, { body, token, prefer } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
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
    barangay_id: barangayId,
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
  }
}

async function main() {
  console.log(`Tenant isolation check — auth=${AUTH_URL} rest=${REST_URL}`)

  // 1. Seed two tenants via service_role (bypasses RLS, same role the old
  // PocketBase superuser token played — used only to seed fixtures).
  const stamp = Date.now()
  const barangayA = await req(REST_URL, 'POST', '/barangays', {
    token: SERVICE_ROLE_KEY,
    prefer: 'return=representation',
    body: { name: `Tenant A ${stamp}`, active: true },
  })
  const barangayB = await req(REST_URL, 'POST', '/barangays', {
    token: SERVICE_ROLE_KEY,
    prefer: 'return=representation',
    body: { name: `Tenant B ${stamp}`, active: true },
  })
  check('barangay A created', barangayA.status === 201, `status=${barangayA.status} ${JSON.stringify(barangayA.json)}`)
  check('barangay B created', barangayB.status === 201, `status=${barangayB.status} ${JSON.stringify(barangayB.json)}`)
  if (barangayA.status !== 201 || barangayB.status !== 201) return finish()
  const idA = barangayA.json[0].id
  const idB = barangayB.json[0].id

  // 2. Seed one staff user per tenant via GoTrue's admin API. Using "staff"
  // (not "admin") deliberately sidesteps the MFA requirement
  // (0000_auth_helpers.sql's app.mfa_satisfied(), gated on
  // 0003_custom_access_token_hook.sql's require_mfa claim) — role=admin
  // always requires aal2; role=staff only does when the tenant's own
  // require_staff_mfa flag is set, which defaults to false and is left
  // false for these throwaway tenants. This script is only about tenant
  // data isolation, not MFA (verified separately, see
  // scripts/bootstrap-platform-admin.mjs's own next-steps).
  const userA = await req(AUTH_URL, 'POST', '/admin/users', {
    token: SERVICE_ROLE_KEY,
    body: {
      email: `staff-a-${stamp}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
      user_metadata: { role: 'staff', barangay_id: idA, name: 'Staff A' },
    },
  })
  const userB = await req(AUTH_URL, 'POST', '/admin/users', {
    token: SERVICE_ROLE_KEY,
    body: {
      email: `staff-b-${stamp}@example.com`,
      password: 'TestPass123!',
      email_confirm: true,
      user_metadata: { role: 'staff', barangay_id: idB, name: 'Staff B' },
    },
  })
  check('user A created', userA.status === 200, `status=${userA.status} ${JSON.stringify(userA.json)}`)
  check('user B created', userB.status === 200, `status=${userB.status} ${JSON.stringify(userB.json)}`)
  if (userA.status !== 200 || userB.status !== 200) return finish()

  // 3. Sign in as each tenant's own staff user (no more service_role from
  // here on — everything below goes through the same RLS policies a real
  // user hits).
  const authA = await req(AUTH_URL, 'POST', '/token?grant_type=password', {
    body: { email: userA.json.email, password: 'TestPass123!' },
  })
  const authB = await req(AUTH_URL, 'POST', '/token?grant_type=password', {
    body: { email: userB.json.email, password: 'TestPass123!' },
  })
  check('tenant A user login succeeds', authA.status === 200, `status=${authA.status} ${JSON.stringify(authA.json)}`)
  check('tenant B user login succeeds', authB.status === 200, `status=${authB.status} ${JSON.stringify(authB.json)}`)
  if (authA.status !== 200 || authB.status !== 200) return finish()
  const tokenA = authA.json.access_token
  const tokenB = authB.json.access_token

  // 4. Tenant A can create its own data.
  const householdA = await req(REST_URL, 'POST', '/households', {
    token: tokenA,
    prefer: 'return=representation',
    body: householdPayload(idA, `A-${stamp}`),
  })
  check('tenant A can create its own household', householdA.status === 201, `status=${householdA.status} ${JSON.stringify(householdA.json)}`)

  // 5. Tenant A cannot spoof-create data under tenant B's barangay_id — the
  // households_insert policy's `with check` fails, which PostgREST surfaces
  // as a 403 row-level-security violation (Postgres error 42501), not the
  // 400 a PocketBase API rule violation would have produced.
  const spoofed = await req(REST_URL, 'POST', '/households', {
    token: tokenA,
    prefer: 'return=representation',
    body: householdPayload(idB, `SPOOF-${stamp}`),
  })
  check(
    'tenant A cannot spoof-create under tenant B',
    spoofed.status === 403 && spoofed.json?.code === '42501',
    `status=${spoofed.status} ${JSON.stringify(spoofed.json)}`,
  )

  // 6. Tenant B creates its own household so there is something to leak.
  const householdB = await req(REST_URL, 'POST', '/households', {
    token: tokenB,
    prefer: 'return=representation',
    body: householdPayload(idB, `B-${stamp}`),
  })
  check('tenant B can create its own household', householdB.status === 201, `status=${householdB.status} ${JSON.stringify(householdB.json)}`)
  if (householdA.status !== 201 || householdB.status !== 201) return finish()

  // 6b. Regression check: household_number uniqueness is scoped per tenant
  // (idx_households_barangay_number is a composite (barangay_id,
  // household_number) index, not a global one) — two barangays
  // independently numbering their own households is the normal case, not an
  // edge case, so this must never fail.
  const sameNumberA = await req(REST_URL, 'POST', '/households', {
    token: tokenA,
    prefer: 'return=representation',
    body: householdPayload(idA, `SHARED-${stamp}`),
  })
  const sameNumberB = await req(REST_URL, 'POST', '/households', {
    token: tokenB,
    prefer: 'return=representation',
    body: householdPayload(idB, `SHARED-${stamp}`),
  })
  check(
    'two tenants can independently use the same household_number',
    sameNumberA.status === 201 && sameNumberB.status === 201,
    `A=${sameNumberA.status} ${JSON.stringify(sameNumberA.json)} B=${sameNumberB.status} ${JSON.stringify(sameNumberB.json)}`,
  )

  // 7. Tenant A's list never contains tenant B's rows.
  const listA = await req(REST_URL, 'GET', '/households?select=*', { token: tokenA })
  const leaked = (listA.json || []).some((r) => r.id === householdB.json[0].id)
  check('tenant A list excludes tenant B records', listA.status === 200 && !leaked, `leaked=${leaked}`)

  // 8. Tenant A cannot see tenant B's record even when filtering directly by
  // id (no existence leak) — RLS excludes the row from the result set, so
  // this is a 200 with an empty array, not a 404 (see header comment).
  const viewCross = await req(REST_URL, 'GET', `/households?id=eq.${householdB.json[0].id}&select=*`, { token: tokenA })
  check(
    'tenant A cannot view tenant B record by id',
    viewCross.status === 200 && Array.isArray(viewCross.json) && viewCross.json.length === 0,
    `status=${viewCross.status} ${JSON.stringify(viewCross.json)}`,
  )

  // 9. barangays table itself: each staff user only sees their own tenant row.
  const barangayListA = await req(REST_URL, 'GET', '/barangays?select=*', { token: tokenA })
  const onlyOwn =
    barangayListA.status === 200 &&
    barangayListA.json.length === 1 &&
    barangayListA.json[0].id === idA
  check('tenant A sees only its own barangay row', onlyOwn, JSON.stringify(barangayListA.json))

  // 10. system_settings: same key allowed in both tenants (composite unique
  // index idx_system_settings_barangay_key is scoped by barangay_id, not
  // global) and not visible cross-tenant. Created via service_role here
  // (system_settings_insert requires role=admin, an aal2-gated concern this
  // script deliberately sidesteps, same as step 2) — reads below still go
  // through the real tenant-scoped select policy.
  const settingA = await req(REST_URL, 'POST', '/system_settings', {
    token: SERVICE_ROLE_KEY,
    prefer: 'return=representation',
    body: { key: 'org_name', value: 'Tenant A Hall', barangay_id: idA },
  })
  const settingB = await req(REST_URL, 'POST', '/system_settings', {
    token: SERVICE_ROLE_KEY,
    prefer: 'return=representation',
    body: { key: 'org_name', value: 'Tenant B Hall', barangay_id: idB },
  })
  check('tenant A can create system_settings key "org_name"', settingA.status === 201, JSON.stringify(settingA.json))
  check(
    'tenant B can create the same key "org_name" (index scoped per-tenant)',
    settingB.status === 201,
    JSON.stringify(settingB.json),
  )

  const settingsListA = await req(REST_URL, 'GET', '/system_settings?select=*', { token: tokenA })
  const settingsLeaked = settingB.json?.[0]?.id
    ? (settingsListA.json || []).some((r) => r.id === settingB.json[0].id)
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
