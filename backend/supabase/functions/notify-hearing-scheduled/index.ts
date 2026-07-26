// Direct port of notify.pb.js's POST /api/notify/hearing-scheduled route.
// See notify-document-status/index.ts for the shared design notes (why
// this port can use ../_shared/ helpers unlike the original PocketBase
// routerAdd handlers).

import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { json, errorResponse, HttpError } from '../_shared/http.ts'
import { escapeHtml } from '../_shared/esc.ts'
import { sendMail } from '../_shared/mailer.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    await requireUser(req)

    const body = await req.json().catch(() => ({}))
    const to = String(body.to || '')
    const caseNumber = String(body.case_number || '')
    if (!to || !caseNumber) throw new HttpError(400, 'Missing required fields.')

    const partyName = String(body.party_name || '')
    const hearingDate = String(body.hearing_date || '')
    const barangayName = String(body.barangay_name || '')

    const barangayLabel = barangayName ? `Barangay ${barangayName}` : 'the barangay office'
    const subject = `Hearing scheduled for blotter case #${caseNumber}`
    const html = `
      <p>Hello ${escapeHtml(partyName) || 'there'},</p>
      <p>A hearing has been scheduled for blotter case <strong>#${escapeHtml(caseNumber)}</strong>${hearingDate ? ` on <strong>${escapeHtml(hearingDate)}</strong>` : ''}. Please coordinate with ${escapeHtml(barangayLabel)} for details.</p>
      <p style="color:#6b8078;font-size:12px;">This is an automated message from ${escapeHtml(barangayLabel)}'s CLUSTR system.</p>
    `

    await sendMail({ to, subject, html })

    return json({ success: true })
  } catch (err) {
    return errorResponse(err)
  }
})
