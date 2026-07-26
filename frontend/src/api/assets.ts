import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { createActivity } from './activity'
import { orIlike } from './supabaseFilters'
import type { BaseRecord } from './types'
import type { PaginatedResult } from '@/lib/utils'

const COLLECTION = 'assets'

export interface AssetData {
  name: string
  asset_type: string
  description?: string
  serial_number?: string
  purchase_date?: string
  purchase_cost?: number
  current_value?: number
  condition: string
  status?: string
  assigned_to?: string
  location?: string
  image_url?: string
  notes?: string
}

export interface ApiAsset extends BaseRecord, AssetData {}

export interface AssetSummary {
  total: number
  byType: Record<string, number>
  byCondition: Record<string, number>
  byStatus: Record<string, number>
}

export async function getAssets(): Promise<ApiAsset[]> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getFullList<ApiAsset>({ sort: '-id' })
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').order('id', { ascending: false })
    if (error) throw error
    return data as ApiAsset[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getAsset(id: string): Promise<ApiAsset> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getOne<ApiAsset>(id)
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').eq('id', id).single()
    if (error) throw error
    return data as ApiAsset
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createAsset(data: AssetData): Promise<ApiAsset> {
  try {
    let result: ApiAsset
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiAsset>(data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(data).select().single()
      if (error) throw error
      result = row as ApiAsset
    }
    createActivity('create', COLLECTION, result.id, `Created asset: ${result.name}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function updateAsset(id: string, data: Partial<AssetData>): Promise<ApiAsset> {
  try {
    let result: ApiAsset
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiAsset>(id, data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(data).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiAsset
    }
    createActivity('update', COLLECTION, id, `Updated asset: ${result.name}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function deleteAsset(id: string): Promise<boolean> {
  try {
    await getAsset(id)
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createActivity('delete', COLLECTION, id, 'Deleted asset')
    return true
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getAssetsPage(
  page = 1,
  perPage = 25,
  options: { search?: string; type?: string; condition?: string; status?: string } = {},
): Promise<PaginatedResult<ApiAsset>> {
  try {
    if (isDemoModeEnabled()) {
      const filters: string[] = []
      if (options.search) {
        filters.push(getClient().filter('(name ~ {:q} || serial_number ~ {:q})', { q: options.search }))
      }
      if (options.type) filters.push(getClient().filter('asset_type = {:t}', { t: options.type }))
      if (options.condition) filters.push(getClient().filter('condition = {:c}', { c: options.condition }))
      if (options.status) filters.push(getClient().filter('status = {:s}', { s: options.status }))
      const query: Record<string, unknown> = { sort: '-id' }
      if (filters.length > 0) query.filter = filters.join(' && ')
      const result = await getClient().collection(COLLECTION).getList<ApiAsset>(page, perPage, query)
      return { items: result.items, totalItems: result.totalItems, totalPages: result.totalPages }
    }

    let q = getSupabase().from(COLLECTION).select('*', { count: 'exact' })
    if (options.search) q = q.or(orIlike(['name', 'serial_number'], options.search))
    if (options.type) q = q.eq('asset_type', options.type)
    if (options.condition) q = q.eq('condition', options.condition)
    if (options.status) q = q.eq('status', options.status)
    const from = (page - 1) * perPage
    const { data, error, count } = await q.order('id', { ascending: false }).range(from, from + perPage - 1)
    if (error) throw error
    const totalItems = count ?? 0
    return { items: data as ApiAsset[], totalItems, totalPages: Math.max(1, Math.ceil(totalItems / perPage)) }
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getAssetSummary(): Promise<AssetSummary> {
  try {
    let all: ApiAsset[]
    if (isDemoModeEnabled()) {
      all = await getClient().collection(COLLECTION).getFullList<ApiAsset>({ requestKey: 'assets-summary' })
    } else {
      const { data, error } = await getSupabase().from(COLLECTION).select('*')
      if (error) throw error
      all = data as ApiAsset[]
    }
    const byType: Record<string, number> = {}
    const byCondition: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    for (const a of all) {
      byType[a.asset_type] = (byType[a.asset_type] || 0) + 1
      byCondition[a.condition] = (byCondition[a.condition] || 0) + 1
      const s = a.status ?? 'unknown'
      byStatus[s] = (byStatus[s] || 0) + 1
    }
    return { total: all.length, byType, byCondition, byStatus }
  } catch {
    return { total: 0, byType: {}, byCondition: {}, byStatus: {} }
  }
}
