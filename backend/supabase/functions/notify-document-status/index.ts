// Direct port of notify.pb.js's POST /api/notify/document-status route.
// Email notifications for document status changes ("ready for release" /
// "released"). Templates are built server-side (not passed in as raw HTML
// by the caller) so this can't be used as a generic authenticated mail
// relay, and so the wording stays centrally controlled — same rationale as
// the PocketBase version.
//
// Note on the "self-contained handler" constraint from the original
// notify.pb.js: that was a PocketBase 0.39.5 routerAdd-specific quirk
// (a callback only sees bindings declared inside itself). Deno/edge-runtime
// has no such limitation — ordinary ES module imports work normally, so
// this port freely shares esc()/documentTitle()/mailer via ../_shared/.
//
// Requires a real signed-in session (any authenticated user, no role
// restriction — matches the original's $apis.requireAuth()) and SMTP env
// vars (see ../_shared/mailer.ts).

import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { json, errorResponse, HttpError } from '../_shared/http.ts'
import { escapeHtml } from '../_shared/esc.ts'
import { documentTitle } from '../_shared/documentTitle.ts'
import { sendMail } from '../_shared/mailer.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    await requireUser(req)

    const body = await req.json().catch(() => ({}))
    const to = String(body.to || '')
    const queueNumber = String(body.queue_number || '')
    if (!to || !queueNumber) throw new HttpError(400, 'Missing required fields.')

    const residentName = String(body.resident_name || '')
    const documentType = String(body.document_type || '')
    const status = String(body.status || '')
    const barangayName = String(body.barangay_name || '')

    const docLabel = documentTitle(documentType)
    const barangayLabel = barangayName ? `Barangay ${barangayName}` : 'the barangay office'

    let subject: string
    let bodyLine: string
    if (status === 'for_release') {
      subject = `Your ${docLabel} is ready for release — #${queueNumber}`
      bodyLine = `Your <strong>${escapeHtml(docLabel)}</strong> request (queue #${escapeHtml(queueNumber)}) is now ready for release. Please visit ${escapeHtml(barangayLabel)} to claim it.`
    } else if (status === 'released') {
      subject = `${docLabel} released — #${queueNumber}`
      bodyLine = `Your <strong>${escapeHtml(docLabel)}</strong> request (queue #${escapeHtml(queueNumber)}) has been released. Thank you.`
    } else {
      subject = `Update on your ${docLabel} request — #${queueNumber}`
      bodyLine = `There's an update on your <strong>${escapeHtml(docLabel)}</strong> request (queue #${escapeHtml(queueNumber)}).`
    }

    const html = `
      <p>Hello ${escapeHtml(residentName) || 'there'},</p>
      <p>${bodyLine}</p>
      <p style="color:#6b8078;font-size:12px;">This is an automated message from ${escapeHtml(barangayLabel)}'s CLUSTR system.</p>
    `

    await sendMail({ to, subject, html })

    return json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
})
