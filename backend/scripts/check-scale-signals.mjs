#!/usr/bin/env node
// Phase 6 scale-signal check — rewritten from PocketBase's
// `/api/logs.execTime` + nginx `stub_status` connection count onto the
// Postgres-native equivalents, per docs/SUPABASE_MIGRATION_PLAN.md Phase 6.
// Same purpose as before: watch the numbers instead of guessing when the
// shared Postgres instance needs a bigger box, a pooler tuned differently,
// or a shard.
//
// Checks three things and reports pass/fail against configurable
// thresholds (see docs/DEPLOYMENT.md "Watching scale signals" for what
// each one means and what to do when it trips):
//
//   1. Write-statement latency, from pg_stat_statements — the direct
//      analogue of PocketBase's execTime log field, and (like before) a
//      proxy for lock contention: latency on INSERT/UPDATE/DELETE climbs
//      sharply once contention sets in, well before connection counts do.
//      pg_stat_statements exposes mean/stddev/max, not true percentiles, so
//      the reported "p95" is a normal-distribution approximation
//      (mean + 1.645*stddev) — a real methodology change from the old
//      script's exact p95 over raw per-request samples, called out here so
//      the number isn't mistaken for the same kind of measurement.
//   2. Database size + day-over-day growth rate, via pg_database_size() —
//      same purpose as the old data.db file-size check, no methodology
//      change (a whole-database size was always the right unit; SQLite
//      just happened to make that trivially a single file's stat()).
//   3. Concurrent active connections, via pg_stat_activity — replaces
//      nginx's stub_status connection count. Counts backend connections in
//      'active' state (i.e. mid-query), which is what actually matters for
//      contention; idle-in-pool connections held open by Supavisor are
//      deliberately not counted here (that's pool utilization, a different
//      signal, not load).
//
// Run this periodically (cron, or manually before/after each onboarding
// wave) — not on every request; it's a health check, not telemetry.
//
// Requires the `psql` CLI on PATH (already a prerequisite for this repo's
// backend/supabase/verify/*.sql and zzz-init-migrations.sh) and a DATABASE_URL
// with rights to read pg_stat_statements/pg_stat_activity — the `postgres`
// superuser role, or a role granted pg_read_all_stats.
//
// Usage:
//   DATABASE_URL=postgres://postgres:...@127.0.0.1:54322/postgres \
//   node scripts/check-scale-signals.mjs
//
// Exits non-zero if any signal breaches its threshold, so it composes with
// cron (`... || mail -s "BarangayOS scale alert" you@example.com`).

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const DATABASE_URL = process.env.DATABASE_URL || ''
const WINDOW_MINUTES = Number(process.env.WINDOW_MINUTES || 15)
const P95_THRESHOLD_MS = Number(process.env.P95_THRESHOLD_MS || 500)
const DB_GROWTH_ALERT_MB_PER_DAY = Number(process.env.DB_GROWTH_ALERT_MB_PER_DAY || 500)
const CONN_ALERT_THRESHOLD = Number(process.env.CONN_ALERT_THRESHOLD || 150)
const STATE_FILE =
  process.env.STATE_FILE || path.join(path.dirname(fileURLToPath(import.meta.url)), '.scale-signals-state.json')

let breached = false

function report(label, ok, detail) {
  console.log(`  ${ok ? 'OK  ' : 'ALERT'} - ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) breached = true
}

async function psql(sql) {
  const { stdout } = await execFileAsync('psql', [DATABASE_URL, '-tAc', sql])
  return stdout.trim()
}

async function checkWriteLatency() {
  console.log(`\n[1/3] Write-statement latency (pg_stat_statements, proxy for lock contention)`)

  if (!DATABASE_URL) {
    console.log('  SKIP - DATABASE_URL not set')
    return
  }

  let row
  try {
    row = await psql(`
      select
        coalesce(avg(mean_exec_time), 0) as mean_ms,
        coalesce(stddev_samp(mean_exec_time), 0) as stddev_ms,
        coalesce(sum(calls), 0) as n
      from pg_stat_statements
      where (query ilike 'insert into%' or query ilike 'update %' or query ilike 'delete from%')
        and query not ilike '%pg_stat_statements%'
    `)
  } catch (err) {
    report('query pg_stat_statements', false, err.message.split('\n')[0])
    return
  }

  const [meanStr, stddevStr, nStr] = row.split('|')
  const mean = Number(meanStr)
  const stddev = Number(stddevStr)
  const n = Number(nStr)

  if (!n) {
    console.log('  (no write statements recorded yet — nothing to measure)')
    return
  }

  const p95Estimate = mean + 1.645 * stddev
  report(
    `p95 write latency (approx): ${p95Estimate.toFixed(1)}ms (mean: ${mean.toFixed(1)}ms, n=${n} calls since last pg_stat_statements reset)`,
    p95Estimate <= P95_THRESHOLD_MS,
    p95Estimate > P95_THRESHOLD_MS ? `exceeds ${P95_THRESHOLD_MS}ms threshold` : undefined,
  )
  console.log(
    `  (window/reset note: pg_stat_statements aggregates since its last reset, not a rolling ${WINDOW_MINUTES}m window — run 'select pg_stat_statements_reset();' periodically, e.g. right after each check, for a comparable per-run figure)`,
  )
}

async function checkDbSize() {
  console.log('\n[2/3] Database size + growth rate')

  if (!DATABASE_URL) {
    console.log('  SKIP - DATABASE_URL not set')
    return
  }

  let sizeBytes
  try {
    sizeBytes = Number(await psql('select pg_database_size(current_database())'))
  } catch (err) {
    report('read pg_database_size', false, err.message.split('\n')[0])
    return
  }

  const sizeMb = sizeBytes / (1024 * 1024)
  console.log(`  database size: ${sizeMb.toFixed(1)} MB`)

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
  console.log('\n[3/3] Concurrent active connections (pg_stat_activity)')

  if (!DATABASE_URL) {
    console.log('  SKIP - DATABASE_URL not set')
    return
  }

  let active
  try {
    active = Number(
      await psql(`
        select count(*) from pg_stat_activity
        where state = 'active' and pid <> pg_backend_pid()
      `),
    )
  } catch (err) {
    report('query pg_stat_activity', false, err.message.split('\n')[0])
    return
  }

  report(`active connections: ${active}`, active <= CONN_ALERT_THRESHOLD, active > CONN_ALERT_THRESHOLD ? `exceeds ${CONN_ALERT_THRESHOLD} threshold` : undefined)
}

async function main() {
  console.log(`Scale signal check against ${DATABASE_URL ? DATABASE_URL.replace(/:[^:@]*@/, ':****@') : '(no DATABASE_URL set)'}`)
  await checkWriteLatency()
  await checkDbSize()
  await checkConnections()

  console.log('')
  if (breached) {
    console.error('One or more scale signals breached their threshold — see docs/DEPLOYMENT.md "Watching scale signals" for next steps.')
    process.exit(1)
  }
  console.log('All scale signals within threshold.')
}

main().catch((err) => {
  console.error('Unexpected error running scale-signal checks:', err)
  process.exit(1)
})
