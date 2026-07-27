import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { createActivity } from './activity'
import { indexBlotter, deleteBlotterFromIndex } from './searchSync'
import { orIlike } from './supabaseFilters'
import type { BaseRecord } from './types'
import type { PaginatedResult } from '@/lib/utils'

const COLLECTION = 'blotter_records'

export interface BlotterData {
  case_number?: string
  incident_type: string
  complainant_name: string
  complainant_contact?: string
  respondent_name?: string
  respondent_contact?: string
  incident_date?: string
  incident_location?: string
  narrative?: string
  status?: string
  action_taken?: string
  involved_parties?: string
}

export interface ApiBlotter extends BaseRecord {
  case_number: string
  incident_type: string
  complainant_name: string
  complainant_contact: string
  respondent_name: string
  respondent_contact: string
  incident_date: string
  incident_location: string
  narrative: string
  status: string
  action_taken: string
  involved_parties: string
  created_by: string
}

export async function getBlotters(): Promise<ApiBlotter[]> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getFullList<ApiBlotter>({ sort: '-incident_date' })
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').order('incident_date', { ascending: false })
    if (error) throw error
    return data as ApiBlotter[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getBlotter(id: string): Promise<ApiBlotter> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getOne<ApiBlotter>(id)
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').eq('id', id).single()
    if (error) throw error
    return data as ApiBlotter
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createBlotter(data: BlotterData): Promise<ApiBlotter> {
  try {
    let result: ApiBlotter
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiBlotter>(data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(data).select().single()
      if (error) throw error
      result = row as ApiBlotter
    }
    createActivity('create', COLLECTION, result.id, `Created blotter record: ${result.case_number} — ${result.incident_type}`)
    indexBlotter(result)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function updateBlotter(id: string, data: Partial<BlotterData>): Promise<ApiBlotter> {
  try {
    let result: ApiBlotter
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiBlotter>(id, data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(data).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiBlotter
    }
    createActivity('update', COLLECTION, id, `Updated blotter record: ${result.case_number} — status: ${result.status}`)
    indexBlotter(result)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function deleteBlotter(id: string): Promise<boolean> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createActivity('delete', COLLECTION, id, 'Deleted blotter record')
    deleteBlotterFromIndex(id)
    return true
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getBlottersPage(
  page = 1,
  perPage = 25,
  options: { search?: string; status?: string; incidentType?: string } = {},
): Promise<PaginatedResult<ApiBlotter>> {
  try {
    if (isDemoModeEnabled()) {
      const filters: string[] = []
      if (options.search) {
        filters.push(getClient().filter('(complainant_name ~ {:q} || respondent_name ~ {:q} || case_number ~ {:q})', { q: options.search }))
      }
      if (options.status) filters.push(getClient().filter('status = {:s}', { s: options.status }))
      if (options.incidentType) filters.push(getClient().filter('incident_type = {:t}', { t: options.incidentType }))
      const query: Record<string, unknown> = { sort: '-incident_date' }
      if (filters.length > 0) query.filter = filters.join(' && ')
      const result = await getClient().collection(COLLECTION).getList<ApiBlotter>(page, perPage, query)
      return { items: result.items, totalItems: result.totalItems, totalPages: result.totalPages }
    }

    let q = getSupabase().from(COLLECTION).select('*', { count: 'exact' })
    if (options.search) q = q.or(orIlike(['complainant_name', 'respondent_name', 'case_number'], options.search))
    if (options.status) q = q.eq('status', options.status)
    if (options.incidentType) q = q.eq('incident_type', options.incidentType)
    const from = (page - 1) * perPage
    const { data, error, count } = await q.order('incident_date', { ascending: false }).range(from, from + perPage - 1)
    if (error) throw error
    const totalItems = count ?? 0
    return { items: data as ApiBlotter[], totalItems, totalPages: Math.max(1, Math.ceil(totalItems / perPage)) }
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getNextCaseNumber(): Promise<string> {
  try {
    const year = new Date().getFullYear()
    let existing: ApiBlotter[]
    if (isDemoModeEnabled()) {
      existing = await getClient().collection(COLLECTION).getFullList<ApiBlotter>({
        filter: `case_number ~ 'BLT-${year}-'`,
        requestKey: 'next-case-number',
      })
    } else {
      const { data, error } = await getSupabase().from(COLLECTION).select('*').ilike('case_number', `BLT-${year}-%`)
      if (error) throw error
      existing = data as ApiBlotter[]
    }
    const max = existing.reduce((maxN, b) => {
      const parts = b.case_number.split('-')
      const num = parseInt(parts[2] || '0', 10)
      return num > maxN ? num : maxN
    }, 0)
    return `BLT-${year}-${String(max + 1).padStart(3, '0')}`
  } catch {
    return `BLT-${new Date().getFullYear()}-001`
  }
}

export async function getBlottersSummary(): Promise<{ total: number; pending: number; hearing: number; settled: number; escalated: number; dismissed: number }> {
  try {
    let all: ApiBlotter[]
    if (isDemoModeEnabled()) {
      all = await getClient().collection(COLLECTION).getFullList<ApiBlotter>({ requestKey: 'blotter-summary' })
    } else {
      const { data, error } = await getSupabase().from(COLLECTION).select('*')
      if (error) throw error
      all = data as ApiBlotter[]
    }
    return {
      total: all.length,
      pending: all.filter((b) => b.status === 'pending').length,
      hearing: all.filter((b) => b.status === 'hearing').length,
      settled: all.filter((b) => b.status === 'settled').length,
      escalated: all.filter((b) => b.status === 'escalated').length,
      dismissed: all.filter((b) => b.status === 'dismissed').length,
    }
  } catch {
    return { total: 0, pending: 0, hearing: 0, settled: 0, escalated: 0, dismissed: 0 }
  }
}
