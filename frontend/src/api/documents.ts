import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { createActivity } from './activity'
import { getFinanceConfig, getSetting } from './settings'
import { indexDocument, deleteDocumentFromIndex } from './searchSync'
import { orIlike } from './supabaseFilters'
import type { BaseRecord } from './types'
import type { PaginatedResult } from '@/lib/utils'

const COLLECTION = 'document_requests'

export interface DocumentData {
  queue_number?: string
  resident_id?: string
  resident_name?: string
  document_type: string
  other_document_type?: string
  purpose: string
  status?: string
  assigned_to?: string
  notes?: string
  released_at?: string
  received_by?: string
  payment_status?: string
  payment_date?: string
  payment_amount?: number
  or_no?: string
  barangay_name?: string
  signature_data?: string | null
}

export interface ApiDocument extends BaseRecord {
  queue_number: string
  resident_id: string
  resident_name: string
  document_type: string
  other_document_type: string
  purpose: string
  status: string
  assigned_to: string
  notes: string
  requested_at: string
  released_at: string
  received_by: string
  payment_status: string
  payment_amount: number
  or_no: string
  payment_date: string
  barangay_name: string
  signature_data: string
}

/** Minimal, safe-to-expose-publicly subset shown on the QR verification page. */
export interface PublicDocumentVerification {
  id: string
  document_type: string
  other_document_type: string
  resident_name: string
  queue_number: string
  status: string
  released_at: string
  barangay_name: string
  /**
   * Security Phase 7 tamper-evidence: whether this document's release
   * snapshot still matches the hash recorded the moment it was released
   * (public.document_release_chain, via get_public_document_chain_status).
   * `undefined` means the check itself couldn't run (e.g. demo mode, or an
   * older release predating this phase) -- not the same as a failed check.
   */
  chain_verified?: boolean
  chain_recorded_at?: string
}

export async function getDocuments(): Promise<ApiDocument[]> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getFullList<ApiDocument>({ sort: '-requested_at' })
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').order('requested_at', { ascending: false })
    if (error) throw error
    return data as ApiDocument[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getDocument(id: string): Promise<ApiDocument> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getOne<ApiDocument>(id)
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').eq('id', id).single()
    if (error) throw error
    return data as ApiDocument
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createDocument(data: DocumentData): Promise<ApiDocument> {
  try {
    let payload = data
    if (!payload.barangay_name) {
      // Snapshot the tenant's configured display name at request time (same
      // pattern as resident_name below) — the public QR verification page
      // is unauthenticated and can't read system_settings, so this can't be
      // resolved later via a live join.
      const barangayName = await getSetting('barangay_name').catch(() => null)
      if (barangayName) payload = { ...payload, barangay_name: String(barangayName) }
    }

    let result: ApiDocument
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiDocument>(payload)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(payload).select().single()
      if (error) throw error
      result = row as ApiDocument
    }
    createActivity('create', COLLECTION, result.id, `Created document request: ${result.queue_number} — ${result.document_type}`)
    indexDocument(result)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

/**
 * Fetches only the fields safe to show on the public, unauthenticated QR
 * verification page, via the get_public_document RPC (migrations/
 * 0026_get_public_document_rpc.sql) — SECURITY DEFINER, only returns
 * status="released" rows, and only the columns listed there (no notes,
 * assigned_to, signature_data, ...). Returns null for anything that isn't a
 * released, existing document (pending/processing/cancelled requests stay
 * fully private) or, in demo mode, isn't released.
 */
export async function getDocumentForVerification(id: string): Promise<PublicDocumentVerification | null> {
  try {
    if (isDemoModeEnabled()) {
      const doc = await getClient().collection(COLLECTION).getOne<ApiDocument>(id, { requestKey: null })
      if (doc.status !== 'released') return null
      return {
        id: doc.id,
        document_type: doc.document_type,
        other_document_type: doc.other_document_type,
        resident_name: doc.resident_name,
        queue_number: doc.queue_number,
        status: doc.status,
        released_at: doc.released_at,
        barangay_name: doc.barangay_name,
        // No real hash chain in browser-only demo mode -- nothing to tamper-check against.
        chain_verified: true,
        chain_recorded_at: doc.released_at,
      }
    }

    const { data, error } = await getSupabase().rpc('get_public_document', { doc_id: id })
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return null

    let chain: { chain_verified?: boolean; chain_recorded_at?: string } | null = null
    try {
      const { data: chainData } = await getSupabase().rpc('get_public_document_chain_status', { p_document_request_id: id })
      chain = Array.isArray(chainData) ? chainData[0] : chainData
    } catch {
      chain = null
    }

    return {
      ...row,
      chain_verified: chain?.chain_verified ?? undefined,
      chain_recorded_at: chain?.chain_recorded_at ?? undefined,
    }
  } catch {
    return null
  }
}

export async function updateDocument(id: string, data: Partial<DocumentData>): Promise<ApiDocument> {
  try {
    let result: ApiDocument
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiDocument>(id, data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(data).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiDocument
    }
    createActivity('update', COLLECTION, id, `Updated document request: ${result.queue_number} — status: ${result.status}`)
    indexDocument(result)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function deleteDocument(id: string): Promise<boolean> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createActivity('delete', COLLECTION, id, 'Deleted document request')
    deleteDocumentFromIndex(id)
    return true
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getDocumentsPage(
  page = 1,
  perPage = 25,
  options: { search?: string; status?: string; documentType?: string } = {},
): Promise<PaginatedResult<ApiDocument>> {
  try {
    if (isDemoModeEnabled()) {
      const filters: string[] = []
      if (options.search) {
        filters.push(getClient().filter('(resident_name ~ {:q} || queue_number ~ {:q})', { q: options.search }))
      }
      if (options.status) filters.push(getClient().filter('status = {:s}', { s: options.status }))
      if (options.documentType) filters.push(getClient().filter('document_type = {:t}', { t: options.documentType }))
      const query: Record<string, unknown> = { sort: '-requested_at' }
      if (filters.length > 0) query.filter = filters.join(' && ')
      const result = await getClient().collection(COLLECTION).getList<ApiDocument>(page, perPage, query)
      return { items: result.items, totalItems: result.totalItems, totalPages: result.totalPages }
    }

    let q = getSupabase().from(COLLECTION).select('*', { count: 'exact' })
    if (options.search) q = q.or(orIlike(['resident_name', 'queue_number'], options.search))
    if (options.status) q = q.eq('status', options.status)
    if (options.documentType) q = q.eq('document_type', options.documentType)
    const from = (page - 1) * perPage
    const { data, error, count } = await q.order('requested_at', { ascending: false }).range(from, from + perPage - 1)
    if (error) throw error
    const totalItems = count ?? 0
    return { items: data as ApiDocument[], totalItems, totalPages: Math.max(1, Math.ceil(totalItems / perPage)) }
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getDocumentFee(documentType: string): Promise<number> {
  try {
    const config = await getFinanceConfig()
    if (!config?.document_fees) return 0
    const fee = (config.document_fees as unknown as Record<string, number>)[documentType]
    return fee ?? 0
  } catch { return 0 }
}

export async function getDailyQueueNumber(): Promise<string> {
  try {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const startOfDay = `${yyyy}-${mm}-${dd} 00:00:00`

    let existing: ApiDocument[]
    if (isDemoModeEnabled()) {
      existing = await getClient().collection(COLLECTION).getFullList<ApiDocument>({
        filter: getClient().filter('requested_at >= {:start}', { start: startOfDay }),
        requestKey: 'daily-queue',
      })
    } else {
      const { data, error } = await getSupabase().from(COLLECTION).select('*').gte('requested_at', startOfDay)
      if (error) throw error
      existing = data as ApiDocument[]
    }
    const next = existing.length + 1
    return String(next).padStart(3, '0')
  } catch {
    return '001'
  }
}
