// Direct port of search.pb.js's POST /api/search/index route. The
// frontend never talks to Meilisearch directly and never sees
// MEILI_MASTER_KEY — every index write is forced to the caller's own
// barangay_id, sourced from the verified JWT (../_shared/auth.ts), never
// from client-supplied data. That one line (`doc.barangay_id =
// user.barangayId`, below) is the entire tenant-isolation mechanism here,
// same as the PocketBase version.
//
// One-time Meilisearch index setup (primaryKey + filterable-attributes)
// used to run as a top-level IIFE at PocketBase boot — Edge Functions have
// no equivalent "on boot" hook, so that move to
// backend/scripts/setup-search-indexes.mjs, run once at deploy time. See
// that script's header and backend/supabase/PHASE4_NOTES.md.
//
// No-ops with a clear response if MEILI_URL is unset — search is an
// enhancement, not a hard dependency, matching the original.

import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { json, errorResponse, HttpError } from '../_shared/http.ts'

const ALLOWED_INDEXES = ['residents', 'document_requests', 'blotter_records']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const user = await requireUser(req)
    if (!user.barangayId) throw new HttpError(400, 'No barangay_id on the authenticated account.')

    const body = await req.json().catch(() => ({}))
    const index = String(body.index || '')
    const action = String(body.action || '')
    const doc: Record<string, unknown> =
      body.document && typeof body.document === 'object' ? { ...body.document } : {}

    if (!ALLOWED_INDEXES.includes(index)) throw new HttpError(400, 'Invalid search index.')
    if (!doc.id) throw new HttpError(400, 'Missing document id.')

    const meiliUrl = Deno.env.get('MEILI_URL')
    const meiliKey = Deno.env.get('MEILI_MASTER_KEY') || ''
    if (!meiliUrl) {
      return json({ success: false, reason: 'search not configured' })
    }

    if (action === 'delete') {
      await fetch(`${meiliUrl}/indexes/${index}/documents/${encodeURIComponent(String(doc.id))}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${meiliKey}` },
      })
    } else {
      doc.barangay_id = user.barangayId
      await fetch(`${meiliUrl}/indexes/${index}/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${meiliKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([doc]),
      })
    }

    return json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
})
