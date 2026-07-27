// Security Phase 3: replaces the unsigned Cloudinary upload preset
// (frontend/src/api/upload.ts used to POST straight to Cloudinary with
// only a cloud name + a public, guessable upload_preset name — anyone who
// found that preset in the shipped JS bundle could upload arbitrary
// content to this barangay's Cloudinary account). A signed upload requires
// CLOUDINARY_API_SECRET, which only this server-side function ever holds;
// the frontend now asks here first, then uploads directly to Cloudinary
// using the short-lived signature this returns.
//
// Only `timestamp` is signed (Cloudinary's documented minimum) — the
// frontend must send exactly that one extra param (plus api_key, file,
// signature, which Cloudinary itself excludes from the signed payload) or
// the upload is rejected with a signature mismatch. Cloud name and api key
// are not secrets (Cloudinary's own docs say so — the secret is the only
// part that must stay server-side), so returning them here means the
// frontend needs zero Cloudinary env vars of its own.

import { corsHeaders } from '../_shared/cors.ts'
import { requireUser } from '../_shared/auth.ts'
import { json, errorResponse, HttpError } from '../_shared/http.ts'

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-1', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    await requireUser(req)

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')
    if (!cloudName || !apiKey || !apiSecret) {
      throw new HttpError(503, 'Image uploads are not configured for this deployment.')
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await sha1Hex(`timestamp=${timestamp}${apiSecret}`)

    return json({ cloudName, apiKey, timestamp, signature })
  } catch (err) {
    return errorResponse(err)
  }
})
