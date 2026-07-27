import { getSupabase } from '@/lib/supabaseClient'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

interface SignedUploadParams {
  cloudName: string
  apiKey: string
  timestamp: number
  signature: string
}

// Security Phase 3: Cloudinary no longer accepts this app's uploads via an
// unsigned upload_preset (any client who found that preset name in the
// shipped JS bundle could upload arbitrary content to this barangay's
// account). sign-cloudinary-upload (an authenticated Edge Function) holds
// CLOUDINARY_API_SECRET server-side and hands back a short-lived signature
// for exactly this one upload; Cloudinary rejects anything that doesn't
// match it.
export async function uploadImage(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Only JPEG, PNG, WEBP, or GIF images are allowed.')
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('Image must be smaller than 10 MB.')
  }

  const { data, error } = await getSupabase().functions.invoke<SignedUploadParams>('sign-cloudinary-upload')
  if (error || !data) {
    throw new Error('Failed to prepare image upload.')
  }
  const { cloudName, apiKey, timestamp, signature } = data

  const formData = new FormData()
  formData.append('file', file)
  formData.append('api_key', apiKey)
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'Failed to upload image')
  }

  const uploaded = await res.json()
  return uploaded.secure_url as string
}
