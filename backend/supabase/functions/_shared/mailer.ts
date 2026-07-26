// SMTP delivery for the notify-* functions. PocketBase's mailer.pb.js
// equivalent used `$app.newMailClient().send(...)`, backed by whatever SMTP
// PocketBase's Admin UI (Settings -> Mail) had configured. Self-hosted
// Supabase has no admin-UI mailer at all, so this moves SMTP config to
// explicit env vars (Edge Function secrets) — a deliberate, documented
// behavior change per docs/SUPABASE_MIGRATION_PLAN.md's Phase 4 section,
// not an oversight.
//
// denomailer is a plain SMTP client (STARTTLS/AUTH LOGIN/PLAIN), matching
// PocketBase's own actual-SMTP-protocol behavior — not swapped for an HTTP
// mail API (Resend/Postmark/etc.), which would be a bigger behavior change
// than the plan calls for. Pinned version not yet confirmed reachable from
// this sandbox (no network to deno.land) — verify on first real deploy,
// same as every other pinned image version in this migration.
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import { HttpError } from './http.ts'

export interface SendMailArgs {
  to: string
  subject: string
  html: string
}

export async function sendMail({ to, subject, html }: SendMailArgs): Promise<void> {
  const hostname = Deno.env.get('SMTP_HOST')
  const port = Number(Deno.env.get('SMTP_PORT') || '587')
  const username = Deno.env.get('SMTP_USER')
  const password = Deno.env.get('SMTP_PASSWORD')
  const fromAddress = Deno.env.get('SMTP_FROM_ADDRESS')
  const fromName = Deno.env.get('SMTP_FROM_NAME') || 'CLUSTR'

  if (!hostname || !fromAddress) {
    // Matches this codebase's existing "deferred until configured" pattern
    // (MEILI_MASTER_KEY, LITESTREAM_*) rather than a silent no-op — a
    // notification failure must be visible in function logs even though
    // the frontend caller (postNotify()) itself swallows the error.
    throw new HttpError(503, 'SMTP not configured (SMTP_HOST/SMTP_FROM_ADDRESS unset).')
  }

  const client = new SMTPClient({
    connection: {
      hostname,
      port,
      tls: port === 465,
      auth: username && password ? { username, password } : undefined,
    },
  })

  try {
    await client.send({
      from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
      to,
      subject,
      html,
    })
  } finally {
    await client.close()
  }
}
