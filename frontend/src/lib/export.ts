import { getApiUrl } from './apiConfig'
import { getSupabase } from './supabaseClient'

export type ExportFormat = 'csv' | 'json' | 'sql'

// Note: no backend route ever implemented `/api/collections/*/export`
// (pre-existing — grep backend/pb_hooks turns up nothing) and this function
// has no callers anywhere in the app. Left as-is (still unwired) but with
// its token lookup updated to the current auth model, so this doesn't stay
// a landmine wired to a since-removed localStorage key if it's ever picked
// back up.
export async function triggerExport(
  collection: string,
  format: ExportFormat,
): Promise<void> {
  const url = `${getApiUrl()}/api/collections/${collection}/export?format=${format}`
  const { data } = await getSupabase().auth.getSession()
  const token = data.session?.access_token ?? null

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) throw new Error(`Export failed: ${res.statusText}`)

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `${collection}-${Date.now()}.${format}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
}
