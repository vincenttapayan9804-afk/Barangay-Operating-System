// Direct port of search.pb.js's POST /api/search/query route. Same
// per-role index visibility as the rest of the app (viewers can read
// residents/blotter but not the document queue), and the same
// force-tenant-scoping-from-JWT rule as search-index/index.ts.

import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { json, errorResponse } from '../_shared/http.ts'

const ROLES_BY_INDEX: Record<string, string[]> = {
  residents: ['admin', 'staff', 'viewer'],
  document_requests: ['admin', 'staff'],
  blotter_records: ['admin', 'staff', 'viewer'],
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const user = await requireUser(req)
    if (!user.barangayId) return json({ results: [] })

    const body = await req.json().catch(() => ({}))
    const q = String(body.query || '').trim()
    if (q.length < 2) return json({ results: [] })

    const meiliUrl = Deno.env.get('MEILI_URL')
    const meiliKey = Deno.env.get('MEILI_MASTER_KEY') || ''
    if (!meiliUrl) return json({ results: [], configured: false })

    const safeBarangayId = String(user.barangayId).replace(/"/g, '')
    const requestedIndexes: string[] = Array.isArray(body.indexes) ? body.indexes : []
    const queries = requestedIndexes
      .filter((idx) => (ROLES_BY_INDEX[idx] || []).includes(user.role || ''))
      .map((idx) => ({ indexUid: idx, q, filter: `barangay_id = "${safeBarangayId}"`, limit: 5 }))

    if (queries.length === 0) return json({ results: [] })

    const res = await fetch(`${meiliUrl}/multi-search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${meiliKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
    })
    const data = await res.json().catch(() => ({ results: [] }))
    return json(data)
  } catch (err) {
    return errorResponse(err)
  }
})
