// Thin wrapper around CompreFace's Recognition Service REST API (see
// ../../../compreface/docker-compose.yml) — the only two operations
// login-gate and enroll-face need: add/replace a subject's face template,
// remove it, and check a submitted image against an expected subject.
// Nothing biometric is ever stored in this Postgres database; the actual
// face template lives only inside CompreFace's own store, keyed by
// subject = the account's user id.

const COMPREFACE_URL = Deno.env.get('COMPREFACE_URL') ?? ''
const COMPREFACE_API_KEY = Deno.env.get('COMPREFACE_API_KEY') ?? ''
const SIMILARITY_THRESHOLD = Number(Deno.env.get('COMPREFACE_SIMILARITY_THRESHOLD') ?? '0.92')

export class CompreFaceNotConfigured extends Error {
  constructor() {
    super('Face verification is not configured for this deployment yet.')
  }
}

function requireConfigured() {
  if (!COMPREFACE_URL || !COMPREFACE_API_KEY) throw new CompreFaceNotConfigured()
}

// data:image/jpeg;base64,<...> (as sent by the browser's canvas capture) or
// a bare base64 string — either is accepted so the frontend doesn't have to
// strip the data URL prefix itself.
function decodeDataUrl(imageDataUrl: string): Uint8Array {
  const base64 = imageDataUrl.includes(',') ? imageDataUrl.split(',', 2)[1] : imageDataUrl
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function imageForm(imageDataUrl: string): FormData {
  const form = new FormData()
  form.append('file', new Blob([decodeDataUrl(imageDataUrl)], { type: 'image/jpeg' }), 'face.jpg')
  return form
}

// Adds a face example for this subject. CompreFace supports multiple
// examples per subject (better accuracy across lighting/angle); enrollment
// here is deliberately single-example — good enough for the step-up use
// case this phase scopes to, and simpler to reason about than a
// re-enrollment/averaging policy. Re-enrolling calls deleteSubjectFaces
// first (see enroll-face/index.ts), so a subject always holds exactly the
// most recently captured example.
export async function addFace(subjectId: string, imageDataUrl: string): Promise<void> {
  requireConfigured()
  const res = await fetch(`${COMPREFACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectId)}`, {
    method: 'POST',
    headers: { 'x-api-key': COMPREFACE_API_KEY },
    body: imageForm(imageDataUrl),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`CompreFace add-face failed: ${res.status} ${detail}`)
  }
}

export async function deleteSubjectFaces(subjectId: string): Promise<void> {
  requireConfigured()
  const res = await fetch(`${COMPREFACE_URL}/api/v1/recognition/faces?subject=${encodeURIComponent(subjectId)}`, {
    method: 'DELETE',
    headers: { 'x-api-key': COMPREFACE_API_KEY },
  })
  // 404 just means nothing was enrolled yet — not an error for our purposes
  // (enroll-face calls this before every (re-)enrollment, unconditionally).
  if (!res.ok && res.status !== 404) {
    const detail = await res.text().catch(() => '')
    throw new Error(`CompreFace delete-face failed: ${res.status} ${detail}`)
  }
}

interface RecognizeResult {
  result?: { subjects?: { subject: string; similarity: number }[] }[]
}

// Returns true only if the top match for the submitted image is the
// expected subject AND clears the configured similarity threshold —
// deliberately not "is this subject anywhere in the result list", since a
// low-confidence coincidental match must not be treated as a pass.
export async function verifyFaceMatchesSubject(imageDataUrl: string, expectedSubjectId: string): Promise<boolean> {
  requireConfigured()
  const res = await fetch(`${COMPREFACE_URL}/api/v1/recognition/recognize?limit=1&face_plugins=`, {
    method: 'POST',
    headers: { 'x-api-key': COMPREFACE_API_KEY },
    body: imageForm(imageDataUrl),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`CompreFace recognize failed: ${res.status} ${detail}`)
  }
  const json: RecognizeResult = await res.json()
  const topSubject = json.result?.[0]?.subjects?.[0]
  if (!topSubject) return false
  return topSubject.subject === expectedSubjectId && topSubject.similarity >= SIMILARITY_THRESHOLD
}
