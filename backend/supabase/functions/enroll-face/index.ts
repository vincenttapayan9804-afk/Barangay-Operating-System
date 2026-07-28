// Security Phase 6: face enrollment, the Settings-page counterpart to
// PasskeySettings.tsx's passkey registration. Onboards every role (staff/
// admin/viewer) with a face template in CompreFace *before* any lockout
// happens — accounts that later hit login-gate's 3-failed-attempt
// threshold with no row in face_enrollments fail closed (soft-locked,
// admin-unlock) rather than silently skipping the second factor.
//
// POST   { image } -> replaces any existing template for this account with
//                      the newly captured one (single example, not
//                      averaged across attempts — see _shared/compreface.ts).
// DELETE            -> removes the enrollment entirely (e.g. before
//                      re-enrolling with a clearer photo, or opting out —
//                      though opting out reintroduces the fail-closed risk
//                      above the moment this account is ever locked).
import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { json, errorResponse, HttpError } from '../_shared/http.ts'
import { restRequest } from '../_shared/supabaseAdmin.ts'
import { addFace, deleteSubjectFaces, CompreFaceNotConfigured } from '../_shared/compreface.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const user = await requireUser(req)
    if (!user.barangayId) throw new HttpError(400, 'Your account is not associated with a barangay.')

    if (req.method === 'DELETE') {
      await deleteSubjectFaces(user.id)
      await restRequest(`face_enrollments?user_id=eq.${user.id}`, { method: 'DELETE', prefer: 'return=minimal' })
      return json({ enrolled: false })
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const image = String(body.image || '')
      if (!image) throw new HttpError(400, 'An image is required.')

      // Clear any prior template first so a subject never accumulates more
      // than one enrolled example.
      await deleteSubjectFaces(user.id)
      await addFace(user.id, image)
      await restRequest('face_enrollments?on_conflict=user_id', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates,return=minimal',
        body: { user_id: user.id, barangay_id: user.barangayId },
      })
      return json({ enrolled: true })
    }

    throw new HttpError(405, 'Method not allowed.')
  } catch (err) {
    if (err instanceof CompreFaceNotConfigured) return errorResponse(new HttpError(503, err.message))
    return errorResponse(err)
  }
})
