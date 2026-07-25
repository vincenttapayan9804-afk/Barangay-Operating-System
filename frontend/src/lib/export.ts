import { getApiUrl } from './apiConfig'

export type ExportFormat = 'csv' | 'json' | 'sql'

export async function triggerExport(
  collection: string,
  format: ExportFormat,
): Promise<void> {
  const url = `${getApiUrl()}/api/collections/${collection}/export?format=${format}`
  const token = localStorage.getItem('pocketbase_auth')
    ? JSON.parse(localStorage.getItem('pocketbase_auth') ?? '{}')?.token
    : null

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
