// Not a port of an existing pb_hooks route — a new function surfaced by
// Phase 5's frontend rewrite (docs/SUPABASE_MIGRATION_PLAN.md). PocketBase's
// `users` collection allowed any client satisfying its create rule
// ((body.barangay_id = auth.barangay_id && role="admin") || is_platform_admin)
// to POST a new user record directly — including setting its own password —
// because PocketBase treats its auth collection like any other collection
// with API rules. Supabase splits this: creating an auth.users row is a
// GoTrue admin operation, gated to the service_role key, which must never
// reach the frontend. So platformAdmin.ts's createBarangayAdmin() (used by
// /platform-admin to onboard a new barangay's first admin) now calls this
// function instead of writing to a table directly — same shape as
// backend/scripts/bootstrap-platform-admin.mjs's own admin/users call, just
// reachable over HTTP and gated to an already-authenticated platform admin
// instead of a bare service-role script.

import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { json, errorResponse, HttpError } from '../_shared/http.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const user = await requireUser(req)
    if (!user.isPlatformAdmin) throw new HttpError(403, 'Only a platform admin can create a barangay admin.')

    const body = await req.json().catch(() => ({}))
    const email = String(body.email || '').trim()
    const password = String(body.password || '')
    const barangayId = String(body.barangay_id || '').trim()
    const name = body.name ? String(body.name) : undefined
    if (!email || !password || !barangayId) throw new HttpError(400, 'email, password, and barangay_id are required.')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey ?? '',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'admin', is_platform_admin: false, barangay_id: barangayId, name },
      }),
    })

    const created = await res.json().catch(() => null)
    if (!res.ok) throw new HttpError(res.status, created?.msg || created?.error_description || 'Failed to create the barangay admin account.')

    return json({ id: created.id, email: created.email })
  } catch (err) {
    return errorResponse(err)
  }
})
