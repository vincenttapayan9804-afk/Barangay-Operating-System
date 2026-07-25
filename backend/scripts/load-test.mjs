#!/usr/bin/env node
// Phase 2 load test — validate write-lock headroom before onboarding a new
// wave of barangays, instead of finding out from a live outage.
//
// Seeds one throwaway tenant with CONCURRENCY staff users, then has all of
// them hammer that tenant's households collection concurrently for
// DURATION_SECONDS (a mix of writes and list reads), simulating the kind of
// burst a real deployment sees during month-end document-request rushes —
// many staff across (in production) many barangays writing at once against
// the same shared SQLite database. Reports throughput, error rate, and
// latency percentiles split by write vs read, so a rising p95 on writes as
// CONCURRENCY increases is the concrete "time to shard or scale up" signal
// described in docs/DEPLOYMENT.md "Phase 2: Watching scale signals".
//
// Usage:
//   PB_URL=http://127.0.0.1:8090 \
//   PB_SUPERUSER_EMAIL=admin@example.com PB_SUPERUSER_PASSWORD=... \
//   CONCURRENCY=20 DURATION_SECONDS=30 \
//   node scripts/load-test.mjs
//
// Run this against a staging/test instance, not production — it generates
// real load and real (throwaway) records.

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const PB_SUPERUSER_EMAIL = process.env.PB_SUPERUSER_EMAIL
const PB_SUPERUSER_PASSWORD = process.env.PB_SUPERUSER_PASSWORD
const CONCURRENCY = Number(process.env.CONCURRENCY || 20)
const DURATION_SECONDS = Number(process.env.DURATION_SECONDS || 30)
const WRITE_RATIO = Number(process.env.WRITE_RATIO || 0.7)

if (!PB_SUPERUSER_EMAIL || !PB_SUPERUSER_PASSWORD) {
  console.error('PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD are required.')
  process.exit(1)
}

async function req(method, path, { body, token } = {}) {
  const started = performance.now()
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
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
    // household_number is unique per (barangay_id, household_number) — stamp
    // disambiguates separate runs against the same instance, since a
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
    barangay_id: barangayId,
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
  console.log(`Load test against ${PB_URL} — concurrency=${CONCURRENCY}, duration=${DURATION_SECONDS}s, write_ratio=${WRITE_RATIO}`)

  const suRes = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_SUPERUSER_EMAIL, password: PB_SUPERUSER_PASSWORD }),
  })
  if (!suRes.ok) {
    console.error(`Superuser auth failed (status ${suRes.status}). Aborting.`)
    process.exit(1)
  }
  const suToken = (await suRes.json()).token

  const stamp = Date.now()
  const barangayRes = await fetch(`${PB_URL}/api/collections/barangays/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: suToken },
    body: JSON.stringify({ name: `Load Test ${stamp}`, active: true }),
  })
  const barangay = await barangayRes.json()
  console.log(`Seeded throwaway tenant: ${barangay.id}`)

  console.log(`Seeding ${CONCURRENCY} staff users...`)
  const tokens = []
  for (let i = 0; i < CONCURRENCY; i++) {
    const email = `loadtest-${stamp}-${i}@example.com`
    const userRes = await fetch(`${PB_URL}/api/collections/users/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: suToken },
      body: JSON.stringify({
        email,
        password: 'LoadTest123!',
        passwordConfirm: 'LoadTest123!',
        role: 'staff',
        barangay_id: barangay.id,
        verified: true,
      }),
    })
    if (!userRes.ok) {
      console.error(`Failed to seed user ${i}: ${await userRes.text()}`)
      process.exit(1)
    }
    const loginRes = await fetch(`${PB_URL}/api/collections/users/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password: 'LoadTest123!' }),
    })
    tokens.push((await loginRes.json()).token)
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
        const sample = await req('POST', '/api/collections/households/records', {
          token,
          body: householdPayload(barangay.id, stamp, n),
        })
        writeSamples.push(sample)
      } else {
        const sample = await req('GET', '/api/collections/households/records?perPage=50&sort=-created', { token })
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
        `SQLite write-lock contention signal. See docs/DEPLOYMENT.md "Phase 2" before onboarding more load at this size.`,
    )
  } else {
    console.log(`Write p95 (${writeP95.toFixed(1)}ms) looks healthy at concurrency=${CONCURRENCY}.`)
  }

  console.log(`\nCleanup note: throwaway tenant "${barangay.id}" and its ${CONCURRENCY} users/records were left in place — delete them via the superuser panel if this ran against a shared test instance.`)
}

main().catch((err) => {
  console.error('Unexpected error running load test:', err)
  process.exit(1)
})
