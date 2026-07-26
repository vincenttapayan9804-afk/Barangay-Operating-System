#!/usr/bin/env node
// Load test — validate write headroom before onboarding a new wave of
// barangays, instead of finding out from a live outage. Supabase/Postgres
// port of the PocketBase-era version: talks directly to GoTrue (`auth`) and
// PostgREST (`rest`) on their own ports, the same Kong-bypassing approach
// test-tenant-isolation.mjs uses (see that script's header comment) — Kong's
// apikey requirement isn't part of what this measures, and skipping it
// keeps this runnable against the same minimal db+auth+rest subset CI
// brings up.
//
// Seeds one throwaway tenant with CONCURRENCY staff users, then has all of
// them hammer that tenant's households collection concurrently for
// DURATION_SECONDS (a mix of writes and list reads), simulating the kind of
// burst a real deployment sees during month-end document-request rushes —
// many staff across (in production) many barangays writing at once against
// the same shared Postgres database. Reports throughput, error rate, and
// latency percentiles split by write vs read — the same signal
// docs/DEPLOYMENT.md's "Watching scale signals" section and
// backend/scripts/check-scale-signals.mjs's pg_stat_statements-based write
// latency check are both watching for, just generated under real load
// instead of read from production history.
//
// Usage:
//   AUTH_URL=http://127.0.0.1:9999 REST_URL=http://127.0.0.1:3001 \
//   SERVICE_ROLE_KEY=... \
//   CONCURRENCY=20 DURATION_SECONDS=30 \
//   node scripts/load-test.mjs
//
// Run this against a staging/test instance, not production — it generates
// real load and real (throwaway) records.

const AUTH_URL = process.env.AUTH_URL || 'http://127.0.0.1:9999'
const REST_URL = process.env.REST_URL || 'http://127.0.0.1:3001'
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY
const CONCURRENCY = Number(process.env.CONCURRENCY || 20)
const DURATION_SECONDS = Number(process.env.DURATION_SECONDS || 30)
const WRITE_RATIO = Number(process.env.WRITE_RATIO || 0.7)

if (!SERVICE_ROLE_KEY) {
  console.error('SERVICE_ROLE_KEY is required.')
  process.exit(1)
}

async function req(base, method, path, { body, token } = {}) {
  const started = performance.now()
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(method === 'POST' ? { Prefer: 'return=minimal' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const latencyMs = performance.now() - started
  // Drain the body so the connection can be reused, but don't pay JSON-parse
  // cost on the hot path — only errors need the parsed detail.
  if (!res.ok) await res.text().catch(() => {})
  else await res.body?.cancel().catch(() => {})
  return { status: res.status, latencyMs }
}

function householdPayload(barangayId, stamp, n) {
  return {
    barangay_id: barangayId,
    // household_number is unique per (barangay_id, household_number) —
    // stamp disambiguates separate runs against the same instance, since a
    // throwaway tenant's records may be left behind between runs.
    household_number: `LOAD-${stamp}-${n}`,
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

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[idx]
}

function summarize(label, samples) {
  const latencies = samples.map((s) => s.latencyMs).sort((a, b) => a - b)
  const errors = samples.filter((s) => s.status >= 400).length
  if (samples.length === 0) {
    console.log(`  ${label}: no requests`)
    return
  }
  console.log(
    `  ${label}: n=${samples.length}  errors=${errors} (${((errors / samples.length) * 100).toFixed(1)}%)  ` +
      `p50=${percentile(latencies, 50).toFixed(1)}ms  p95=${percentile(latencies, 95).toFixed(1)}ms  p99=${percentile(latencies, 99).toFixed(1)}ms`,
  )
}

async function main() {
  console.log(`Load test — auth=${AUTH_URL} rest=${REST_URL} — concurrency=${CONCURRENCY}, duration=${DURATION_SECONDS}s, write_ratio=${WRITE_RATIO}`)

  const stamp = Date.now()
  const barangayRes = await fetch(`${REST_URL}/barangays`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: 'return=representation' },
    body: JSON.stringify({ name: `Load Test ${stamp}`, active: true }),
  })
  if (!barangayRes.ok) {
    console.error(`Failed to seed throwaway tenant (status ${barangayRes.status}): ${await barangayRes.text()}`)
    process.exit(1)
  }
  const barangay = (await barangayRes.json())[0]
  console.log(`Seeded throwaway tenant: ${barangay.id}`)

  console.log(`Seeding ${CONCURRENCY} staff users...`)
  const tokens = []
  for (let i = 0; i < CONCURRENCY; i++) {
    const email = `loadtest-${stamp}-${i}@example.com`
    const userRes = await fetch(`${AUTH_URL}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        email,
        password: 'LoadTest123!',
        email_confirm: true,
        user_metadata: { role: 'staff', barangay_id: barangay.id, name: `Load Test ${i}` },
      }),
    })
    if (!userRes.ok) {
      console.error(`Failed to seed user ${i}: ${await userRes.text()}`)
      process.exit(1)
    }
    const loginRes = await fetch(`${AUTH_URL}/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'LoadTest123!' }),
    })
    tokens.push((await loginRes.json()).access_token)
  }

  console.log(`Running for ${DURATION_SECONDS}s...`)
  const writeSamples = []
  const readSamples = []
  const deadline = Date.now() + DURATION_SECONDS * 1000
  let counter = 0

  async function virtualUser(token) {
    while (Date.now() < deadline) {
      if (Math.random() < WRITE_RATIO) {
        const n = counter++
        const sample = await req(REST_URL, 'POST', '/households', {
          token,
          body: householdPayload(barangay.id, stamp, n),
        })
        writeSamples.push(sample)
      } else {
        const sample = await req(REST_URL, 'GET', '/households?select=*&order=created.desc&limit=50', { token })
        readSamples.push(sample)
      }
    }
  }

  const startedAt = Date.now()
  await Promise.all(tokens.map((token) => virtualUser(token)))
  const elapsedSeconds = (Date.now() - startedAt) / 1000

  const total = writeSamples.length + readSamples.length
  console.log('\nResults:')
  console.log(`  total requests: ${total}  (${(total / elapsedSeconds).toFixed(1)} req/s)`)
  summarize('writes', writeSamples)
  summarize('reads ', readSamples)

  const writeP95 = percentile(writeSamples.map((s) => s.latencyMs).sort((a, b) => a - b), 95)
  console.log('')
  if (writeP95 > 500) {
    console.log(
      `Write p95 (${writeP95.toFixed(1)}ms) is elevated at concurrency=${CONCURRENCY} — this is the ` +
        `Postgres write-contention signal. See docs/DEPLOYMENT.md "Watching scale signals" before onboarding more load at this size.`,
    )
  } else {
    console.log(`Write p95 (${writeP95.toFixed(1)}ms) looks healthy at concurrency=${CONCURRENCY}.`)
  }

  console.log(`\nCleanup note: throwaway tenant "${barangay.id}" and its ${CONCURRENCY} users/records were left in place — delete them via the service_role key if this ran against a shared test instance.`)
}

main().catch((err) => {
  console.error('Unexpected error running load test:', err)
  process.exit(1)
})
