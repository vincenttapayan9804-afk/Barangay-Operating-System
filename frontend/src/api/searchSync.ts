import { getClient } from './client'

/**
 * Fire-and-forget Meilisearch sync, mirroring createActivity()'s pattern —
 * a search-index failure must never block the actual mutation. Goes
 * through the PocketBase-proxied /api/search/index route (see
 * backend/pb_hooks/search.pb.js), never Meilisearch directly — the route
 * forces barangay_id from the trusted session, so this file never needs to
 * (and couldn't meaningfully) set it itself.
 *
 * Silently no-ops if Meilisearch isn't configured for this deployment —
 * the route itself handles that gracefully, this just needs to not throw.
 */

export type SearchIndexName = 'residents' | 'document_requests' | 'blotter_records'

async function callSearchIndex(body: Record<string, unknown>): Promise<void> {
  try {
    const client = getClient()
    await fetch(`${client.baseURL}/api/search/index`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: client.authStore.token,
      },
      body: JSON.stringify(body),
    })
  } catch {
    // Silent — indexing failure should not block the main operation.
  }
}

export function indexResident(record: { id: string; first_name?: string; last_name?: string; middle_name?: string }): void {
  callSearchIndex({
    index: 'residents',
    action: 'upsert',
    document: {
      id: record.id,
      first_name: record.first_name || '',
      middle_name: record.middle_name || '',
      last_name: record.last_name || '',
    },
  })
}

export function deleteResidentFromIndex(id: string): void {
  callSearchIndex({ index: 'residents', action: 'delete', document: { id } })
}

export function indexDocument(record: { id: string; resident_name?: string; queue_number?: string; document_type?: string }): void {
  callSearchIndex({
    index: 'document_requests',
    action: 'upsert',
    document: {
      id: record.id,
      resident_name: record.resident_name || '',
      queue_number: record.queue_number || '',
      document_type: record.document_type || '',
    },
  })
}

export function deleteDocumentFromIndex(id: string): void {
  callSearchIndex({ index: 'document_requests', action: 'delete', document: { id } })
}

export function indexBlotter(record: { id: string; case_number?: string; complainant_name?: string; respondent_name?: string }): void {
  callSearchIndex({
    index: 'blotter_records',
    action: 'upsert',
    document: {
      id: record.id,
      case_number: record.case_number || '',
      complainant_name: record.complainant_name || '',
      respondent_name: record.respondent_name || '',
    },
  })
}

export function deleteBlotterFromIndex(id: string): void {
  callSearchIndex({ index: 'blotter_records', action: 'delete', document: { id } })
}
