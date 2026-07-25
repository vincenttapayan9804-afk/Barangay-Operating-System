import type { RecordModel } from 'pocketbase'
import { getClient } from './client'
import { handleApiError } from './errorHandler'
import { createActivity } from './activity'
import { getFinanceConfig, getSetting } from './settings'
import { indexDocument, deleteDocumentFromIndex } from './searchSync'
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

export interface ApiDocument extends RecordModel {
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
  updated: string
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
}

export async function getDocuments(): Promise<ApiDocument[]> {
  try {
    return await getClient().collection(COLLECTION).getFullList<ApiDocument>({ sort: '-requested_at' })
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getDocument(id: string): Promise<ApiDocument> {
  try {
    return await getClient().collection(COLLECTION).getOne<ApiDocument>(id)
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
    const result = await getClient().collection(COLLECTION).create<ApiDocument>(payload)
    createActivity('create', COLLECTION, result.id, `Created document request: ${result.queue_number} — ${result.document_type}`)
    indexDocument(result)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

/**
 * Fetches only the fields safe to show on the public, unauthenticated QR
 * verification page. Server-side, document_requests.viewRule additionally
 * only allows this for status="released" records — see
 * 1785000034_public_document_verification.js. Returns null for anything
 * that isn't a released, existing document (pending/processing/cancelled
 * requests stay fully private).
 */
export async function getDocumentForVerification(id: string): Promise<PublicDocumentVerification | null> {
  try {
    return await getClient()
      .collection(COLLECTION)
      .getOne<PublicDocumentVerification>(id, {
        fields: 'id,document_type,other_document_type,resident_name,queue_number,status,released_at,barangay_name',
        requestKey: null,
      })
  } catch {
    return null
  }
}

export async function updateDocument(id: string, data: Partial<DocumentData>): Promise<ApiDocument> {
  try {
    const result = await getClient().collection(COLLECTION).update<ApiDocument>(id, data)
    createActivity('update', COLLECTION, id, `Updated document request: ${result.queue_number} — status: ${result.status}`)
    indexDocument(result)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function deleteDocument(id: string): Promise<boolean> {
  try {
    await getClient().collection(COLLECTION).delete(id)
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
    const existing = await getClient().collection(COLLECTION).getFullList<ApiDocument>({
      filter: getClient().filter('requested_at >= {:start}', { start: startOfDay }),
      requestKey: 'daily-queue',
    })
    const next = existing.length + 1
    return String(next).padStart(3, '0')
  } catch {
    return '001'
  }
}
