#!/usr/bin/env node
// One-time Meilisearch index setup for the Phase 4 search Edge Functions
// (backend/supabase/functions/search-index, search-query).
//
// search.pb.js ran this as a top-level IIFE on every PocketBase boot.
// Supabase Edge Functions have no equivalent "on boot" hook (each
// invocation is its own stateless request), so this one-time setup moves
// to a script run once at deploy time instead — a deliberate, documented
// move, not an oversight (see backend/supabase/PHASE4_NOTES.md).
//
// Two things every index needs before search-index/search-query will
// actually work (discovered against a real Meilisearch instance while
// building the original PocketBase version):
//   - An explicit primaryKey. Every indexed document has both `id` and
//     `barangay_id` — two fields ending in "id" — so Meilisearch's
//     auto-inference on first write refuses to guess and the write
//     silently fails (task status "failed", but the caller still gets
//     {success:true} since the enqueue itself succeeds).
//   - filterable-attributes including barangay_id, since every query/write
//     filters or forces it.
//
// Both calls are safe to re-run — creating an already-existing index and
// PUT-ing the same settings are no-ops.
//
// Usage:
//   MEILI_URL=http://localhost:7700 MEILI_MASTER_KEY=... node scripts/setup-search-indexes.mjs

const MEILI_URL = process.env.MEILI_URL
const MEILI_MASTER_KEY = process.env.MEILI_MASTER_KEY || ''
const INDEXES = ['residents', 'document_requests', 'blotter_records']

if (!MEILI_URL) {
  console.error('MEILI_URL is required.')
  process.exit(1)
}

async function main() {
  for (const index of INDEXES) {
    try {
      await fetch(`${MEILI_URL}/indexes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${MEILI_MASTER_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: index, primaryKey: 'id' }),
      })
      await fetch(`${MEILI_URL}/indexes/${index}/settings/filterable-attributes`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${MEILI_MASTER_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['barangay_id']),
      })
      console.log(`configured index: ${index}`)
    } catch (err) {
      console.error(`failed to configure index ${index}:`, err)
      process.exitCode = 1
    }
  }
}

main()
