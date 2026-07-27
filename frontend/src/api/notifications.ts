import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { getResident } from './residents'
import type { ApiDocument } from './documents'
import type { ApiBlotter } from './blotter'

/**
 * Fire-and-forget email notifications, matching the same non-blocking
 * pattern as createActivity()/createFinanceAuditLog() — a notification
 * failure (no SMTP configured, resident has no email on file, etc.) must
 * never block the status change that triggered it.
 *
 * Delivery goes through Edge Functions (backend/supabase/functions/
 * notify-document-status, notify-hearing-scheduled — ports of PocketBase's
 * backend/pb_hooks/notify.pb.js) rather than a database trigger — see those
 * functions for why.
 *
 * Demo mode has no backend to deliver against — same silent no-op as
 * before (the old PocketBase-era code attempted the fetch anyway and had it
 * fail silently against an invalid URL; this is just an explicit version of
 * the same behavior).
 */

async function invokeNotify(fn: 'notify-document-status' | 'notify-hearing-scheduled', body: Record<string, unknown>): Promise<void> {
  if (isDemoModeEnabled()) return
  try {
    await getSupabase().functions.invoke(fn, { body })
  } catch {
    // Silent — notification failure should not block the main operation.
  }
}

export async function notifyDocumentStatus(doc: ApiDocument): Promise<void> {
  if (doc.status !== 'for_release' && doc.status !== 'released') return
  try {
    if (!doc.resident_id) return
    const resident = await getResident(doc.resident_id)
    const email = (resident as unknown as { email_address?: string }).email_address
    if (!email) return
    await invokeNotify('notify-document-status', {
      to: email,
      resident_name: doc.resident_name,
      document_type: doc.document_type,
      queue_number: doc.queue_number,
      status: doc.status,
      barangay_name: doc.barangay_name,
    })
  } catch {
    // Resident lookup failed — skip silently, same as above.
  }
}

export async function notifyHearingScheduled(
  blotter: ApiBlotter,
  recipientEmail: string,
  partyName: string,
  barangayName?: string,
): Promise<void> {
  // Blotter records don't carry a structured hearing-date field — the app
  // only tracks status ("hearing"), not a scheduled datetime — so the
  // notification says a hearing was scheduled and points recipients to the
  // barangay office for the specifics, rather than guessing at a date.
  if (!recipientEmail) return
  await invokeNotify('notify-hearing-scheduled', {
    to: recipientEmail,
    party_name: partyName,
    case_number: blotter.case_number,
    barangay_name: barangayName,
  })
}
