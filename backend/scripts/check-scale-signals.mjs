#!/usr/bin/env node
// Phase 2 scale-signal check — watch the numbers instead of guessing when
// the shared PocketBase/SQLite instance needs a bigger box or a shard.
//
// Checks three things and reports pass/fail against configurable
// thresholds (see docs/DEPLOYMENT.md "Phase 2: Watching scale signals" for
// what each one means and what to do when it trips):
//
//   1. p95 write-request latency, from PocketBase's own request logs — a
//      proxy for SQLite write-lock contention (PocketBase doesn't expose
//      the lock wait time directly, but latency on writes climbs sharply
//      once contention sets in).
//   2. data.db file size + day-over-day growth rate, so storage/backup
//      sizing isn't a surprise.
//   3. Concurrent nginx connections, via stub_status, as a coarse load
//      signal independent of PocketBase.
//
// Run this periodically (cron, or manually before/after each onboarding
// wave) — not on every request; it's a health check, not telemetry.
//
// Usage:
//   PB_URL=https://your-instance node scripts/check-scale-signals.mjs
//
// Exits non-zero if any signal breaches its threshold, so it composes with
// cron (`... || mail -s "BarangayOS scale alert" you@example.com`).

import { readFile, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090'
const PB_SUPERUSER_EMAIL = process.env.PB_SUPERUSER_EMAIL
const PB_SUPERUSER_PASSWORD = process.env.PB_SUPERUSER_PASSWORD
const WINDOW_MINUTES = Number(process.env.WINDOW_MINUTES || 15)
const P95_THRESHOLD_MS = Number(process.env.P95_THRESHOLD_MS || 500)
const DB_DATA_DIR = process.env.PB_DATA_DIR || ''
const DB_GROWTH_ALERT_MB_PER_DAY = Number(process.env.DB_GROWTH_ALERT_MB_PER_DAY || 500)
const NGINX_STATUS_URL = process.env.NGINX_STATUS_URL || ''
const CONN_ALERT_THRESHOLD = Number(process.env.CONN_ALERT_THRESHOLD || 150)
const STATE_FILE =
  process.env.STATE_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), '.scale-signals-state.json')

let breached = false

function report(label, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'ALERT'} - ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) breached = true
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[idx]
}

async function checkWriteLatency() {
  console.log(`\n[1/3] Write-request latency (last ${WINDOW_MINUTES}m, proxy for SQLite write-lock contention)`)

  if (!PB_SUPERUSER_EMAIL || !PB_SUPERUSER_PASSWORD) {
    console.log('  SKIP - PB_SUPERUSER_EMAIL / PB_SUPERUSER_PASSWORD not set')
    return
  }

  const auth = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_SUPERUSER_EMAIL, password: PB_SUPERUSER_PASSWORD }),
  })
  if (!auth.ok) {
    report('fetch logs', false, `superuser auth failed (status ${auth.status})`)
    return
  }
  const { token } = await auth.json()

  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
  const url = new URL(`${PB_URL}/api/logs`)
  url.searchParams.set('perPage', '500')
  url.searchParams.set('sort', '-created')
  url.searchParams.set('filter', `created >= "${since}" && (data.method = "POST" || data.method = "PATCH" || data.method = "DELETE")`)

  const res = await fetch(url, { headers: { Authorization: token } })
  if (!res.ok) {
    report('fetch logs', false, `status ${res.status}`)
    return
  }
  const { items } = await res.json()
  const execTimes = items.map((i) => i.data?.execTime).filter((t) => typeof t === 'number').sort((a, b) => a - b)

  if (execTimes.length === 0) {
    console.log('  (no write requests in this window — nothing to measure)')
    return
  }

  const p50 = percentile(execTimes, 50)
  const p95 = percentile(execTimes, 95)
  report(
    `p95 write latency: ${p95.toFixed(1)}ms (p50: ${p50.toFixed(1)}ms, n=${execTimes.length})`,
    p95 <= P95_THRESHOLD_MS,
    p95 > P95_THRESHOLD_MS ? `exceeds ${P95_THRESHOLD_MS}ms threshold` : undefined,
  )
}

async function checkDbSize() {
  console.log('\n[2/3] Database file size + growth rate')

  if (!DB_DATA_DIR) {
    console.log('  SKIP - PB_DATA_DIR not set (point it at the pb_data directory, e.g. /pb/pb_data in the container)')
    return
  }

  let sizeBytes
  try {
    const stats = await stat(path.join(DB_DATA_DIR, 'data.db'))
    sizeBytes = stats.size
  } catch (err) {
    report('read data.db', false, err.message)
    return
  }

  const sizeMb = sizeBytes / (1024 * 1024)
  console.log(`  data.db size: ${sizeMb.toFixed(1)} MB`)

  let prev = null
  try {
    prev = JSON.parse(await readFile(STATE_FILE, 'utf8'))
  } catch {
    // no prior state yet — first run
  }

  const now = Date.now()
  if (prev) {
    const elapsedDays = (now - prev.timestamp) / (1000 * 60 * 60 * 24)
    if (elapsedDays > 0) {
      const growthMbPerDay = (sizeMb - prev.sizeMb) / elapsedDays
      report(
        `growth rate: ${growthMbPerDay >= 0 ? '+' : ''}${growthMbPerDay.toFixed(1)} MB/day (since last check ${elapsedDays.toFixed(2)}d ago)`,
        growthMbPerDay <= DB_GROWTH_ALERT_MB_PER_DAY,
        growthMbPerDay > DB_GROWTH_ALERT_MB_PER_DAY ? `exceeds ${DB_GROWTH_ALERT_MB_PER_DAY} MB/day threshold` : undefined,
      )
    }
  } else {
    console.log('  (no prior reading — growth rate available on next run)')
  }

  await writeFile(STATE_FILE, JSON.stringify({ sizeMb, timestamp: now }, null, 2))
}

async function checkConnections() {
  console.log('\n[3/3] Concurrent nginx connections')

  if (!NGINX_STATUS_URL) {
    console.log('  SKIP - NGINX_STATUS_URL not set (e.g. http://localhost:8080/nginx_status)')
    return
  }

  const res = await fetch(NGINX_STATUS_URL)
  if (!res.ok) {
    report('fetch nginx_status', false, `status ${res.status}`)
    return
  }
  const text = await res.text()
  // Example stub_status body:
  //   Active connections: 3
  //   server accepts handled requests
  //    10 10 20
  //   Reading: 0 Writing: 1 Waiting: 2
  const match = text.match(/Active connections:\s*(\d+)/)
  const active = match ? Number(match[1]) : null
  if (active === null) {
    report('parse nginx_status', false, 'unexpected response format')
    return
  }
  report(`active connections: ${active}`, active <= CONN_ALERT_THRESHOLD, active > CONN_ALERT_THRESHOLD ? `exceeds ${CONN_ALERT_THRESHOLD} threshold` : undefined)
}

async function main() {
  console.log(`Scale signal check against ${PB_URL}`)
  await checkWriteLatency()
  await checkDbSize()
  await checkConnections()

  console.log('')
  if (breached) {
    console.error('One or more scale signals breached their threshold — see docs/DEPLOYMENT.md "Phase 2" for next steps.')
    process.exit(1)
  }
  console.log('All scale signals within threshold.')
}

main().catch((err) => {
  console.error('Unexpected error running scale-signal checks:', err)
  process.exit(1)
})
