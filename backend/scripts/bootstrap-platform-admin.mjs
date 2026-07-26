#!/usr/bin/env node
// One-time bootstrap: creates the first platform-admin account against a
// running Phase 2 stack (backend/supabase/docker-compose.yml). Replaces the
// manual step 1785000028_platform_admin.js's own comment used to require —
// "use the PocketBase superuser panel (/_/) to create a users record with
// role=admin, is_platform_admin=true" — with a runnable script hitting
// GoTrue's admin API instead of raw superuser-panel clicks.
//
// Usage:
//   SUPABASE_URL=http://localhost:8000 \
//   SERVICE_ROLE_KEY=... \
//   PLATFORM_ADMIN_EMAIL=you@example.com \
//   PLATFORM_ADMIN_PASSWORD='a strong password' \
//   node scripts/bootstrap-platform-admin.mjs
//
// What this does NOT do: enroll MFA. 0000_auth_helpers.sql's
// app.mfa_satisfied() gates every RLS policy for role=admin behind aal2
// (Hard Part #2 — see docs/SUPABASE_MIGRATION_PLAN.md), so the very first
// login after this script will see zero rows anywhere until the operator
// completes TOTP enrollment. That's expected, not a bug — see the printed
// next-steps below. Enrolling MFA itself hits GoTrue's own /auth/v1/factors
// endpoints directly, which don't go through PostgREST/RLS at all, so
// there's no chicken-and-egg problem.

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:8000'
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY
const PLATFORM_ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL
const PLATFORM_ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD
const PLATFORM_ADMIN_NAME = process.env.PLATFORM_ADMIN_NAME || 'Platform Admin'
// Seeded by migrations/0001_barangays.sql — not a real barangay, just a
// home for platform-ops accounts so they still satisfy the required
// barangay_id FK like any other profile.
const PLATFORM_TENANT_ID = '00000000-0000-0000-0000-000000000000'

if (!SERVICE_ROLE_KEY || !PLATFORM_ADMIN_EMAIL || !PLATFORM_ADMIN_PASSWORD) {
  console.error('SERVICE_ROLE_KEY, PLATFORM_ADMIN_EMAIL, and PLATFORM_ADMIN_PASSWORD are required.')
  console.error('See this script\'s header comment for usage.')
  process.exit(1)
}

async function main() {
  console.log(`Bootstrapping platform admin against ${SUPABASE_URL} ...`)

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email: PLATFORM_ADMIN_EMAIL,
      password: PLATFORM_ADMIN_PASSWORD,
      // Pre-confirmed — no SMTP dependency for this one-time bootstrap.
      email_confirm: true,
      user_metadata: {
        role: 'admin',
        is_platform_admin: true,
        barangay_id: PLATFORM_TENANT_ID,
        name: PLATFORM_ADMIN_NAME,
      },
    }),
  })

  const json = await res.json().catch(() => null)

  if (!res.ok) {
    console.error(`FAILED: admin/users returned ${res.status}`)
    console.error(JSON.stringify(json, null, 2))
    process.exit(1)
  }

  console.log(`Created auth.users row: ${json.id}`)
  console.log('The on_auth_user_created trigger (0002_profiles.sql) should have provisioned a matching')
  console.log('public.profiles row (role=admin, is_platform_admin=true) automatically.')
  console.log('')
  console.log('Next steps (role=admin always requires MFA, per app.mfa_satisfied()):')
  console.log(`  1. Log in: POST ${SUPABASE_URL}/auth/v1/token?grant_type=password`)
  console.log(`     { "email": "${PLATFORM_ADMIN_EMAIL}", "password": "<the password you set>" }`)
  console.log('     -> yields an aal1 access token. Every RLS-protected table will return zero rows')
  console.log('        with it until step 3 completes — that is app.mfa_satisfied() working as designed.')
  console.log(`  2. Enroll a TOTP factor: POST ${SUPABASE_URL}/auth/v1/factors (Authorization: Bearer <aal1 token>)`)
  console.log('     { "factor_type": "totp" } -> scan the returned QR code / secret in an authenticator app.')
  console.log(`  3. Challenge + verify: POST .../factors/{id}/challenge, then POST .../factors/{id}/verify`)
  console.log('     with the 6-digit code -> yields an aal2 access token. Enrollment (step 2) happens')
  console.log('     once; every future login still starts at aal1 and repeats the challenge+verify')
  console.log('     call (step 3 only) with a fresh code to reach aal2 for that session.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
