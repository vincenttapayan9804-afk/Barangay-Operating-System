import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { createActivity } from './activity'
import { orIlike } from './supabaseFilters'
import type { BaseRecord } from './types'
import type { PaginatedResult } from '@/lib/utils'

const COLLECTION = 'households'

export interface HouseholdData {
  household_number: string
  region?: string
  province?: string
  city_municipality?: string
  barangay?: string
  sitio_purok?: string
  household_complete_address?: string
  no_of_families?: number
  no_of_household_members?: number
  no_of_migrants?: number
  household_type?: string
  household_type_other?: string
  tenure_status?: string
  tenure_status_other?: string
  household_unit?: string
  household_unit_other?: string
  household_name?: string
  monthly_income?: number
  data_set?: string
  // DILG / BIMS National Indicators
  water_system?: string
  waste_disposal?: string
  power_supply?: string
  toilet_type?: string
}

export interface ApiHousehold extends BaseRecord {
  household_number: string
  region: string
  province: string
  city_municipality: string
  barangay: string
  sitio_purok: string
  household_complete_address: string
  no_of_families: number
  no_of_household_members: number
  no_of_migrants: number
  household_type: string
  household_type_other: string
  tenure_status: string
  tenure_status_other: string
  household_unit: string
  household_unit_other: string
  household_name: string
  monthly_income: number
  data_set: string
  // DILG / BIMS National Indicators
  water_system: string
  waste_disposal: string
  power_supply: string
  toilet_type: string
}

export async function getNextHouseholdNumber(): Promise<string> {
  try {
    let all: ApiHousehold[]
    if (isDemoModeEnabled()) {
      all = await getClient().collection(COLLECTION).getFullList<ApiHousehold>({ sort: '-created', requestKey: 'next-hh' })
    } else {
      const { data, error } = await getSupabase().from(COLLECTION).select('*').order('created', { ascending: false })
      if (error) throw error
      all = data as ApiHousehold[]
    }
    let max = 0
    const year = new Date().getFullYear().toString()
    for (const h of all) {
      const m = h.household_number?.match(/BRGY-(\d+)/)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    return `BRGY-${String(max + 1).padStart(4, '0')}-${year}`
  } catch {
    return `BRGY-0001-${new Date().getFullYear()}`
  }
}

export async function getHouseholdsPage(
  page = 1,
  perPage = 25,
  options: { search?: string; sitio_purok?: string } = {},
): Promise<PaginatedResult<ApiHousehold>> {
  try {
    if (isDemoModeEnabled()) {
      const filters: string[] = []
      if (options.search) {
        const q = options.search.replace(/"/g, '\\"')
        filters.push(`(household_number ~ "${q}" || household_name ~ "${q}" || household_complete_address ~ "${q}" || sitio_purok ~ "${q}")`)
      }
      if (options.sitio_purok) filters.push(`sitio_purok = "${options.sitio_purok}"`)
      const query: Record<string, unknown> = { sort: 'household_number' }
      if (filters.length > 0) query.filter = filters.join(' && ')
      const result = await getClient().collection(COLLECTION).getList<ApiHousehold>(page, perPage, query)
      return { items: result.items, totalItems: result.totalItems, totalPages: result.totalPages }
    }

    let q = getSupabase().from(COLLECTION).select('*', { count: 'exact' })
    if (options.search) {
      q = q.or(orIlike(['household_number', 'household_name', 'household_complete_address', 'sitio_purok'], options.search))
    }
    if (options.sitio_purok) q = q.eq('sitio_purok', options.sitio_purok)
    const from = (page - 1) * perPage
    const { data, error, count } = await q.order('household_number').range(from, from + perPage - 1)
    if (error) throw error
    const totalItems = count ?? 0
    return { items: data as ApiHousehold[], totalItems, totalPages: Math.max(1, Math.ceil(totalItems / perPage)) }
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getHouseholds(): Promise<ApiHousehold[]> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getFullList<ApiHousehold>({ sort: 'household_number' })
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').order('household_number')
    if (error) throw error
    return data as ApiHousehold[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function searchHouseholds(query: string): Promise<ApiHousehold[]> {
  try {
    if (isDemoModeEnabled()) {
      const result = await getClient().collection(COLLECTION).getList<ApiHousehold>(1, 20, {
        filter: getClient().filter('(household_number ~ {:q} || household_name ~ {:q} || household_complete_address ~ {:q})', { q: query }),
        sort: 'household_name',
      })
      return result.items
    }

    const { data, error } = await getSupabase()
      .from(COLLECTION)
      .select('*')
      .or(orIlike(['household_number', 'household_name', 'household_complete_address'], query))
      .order('household_name')
      .limit(20)
    if (error) throw error
    return data as ApiHousehold[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getHousehold(id: string): Promise<ApiHousehold> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getOne<ApiHousehold>(id)
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').eq('id', id).single()
    if (error) throw error
    return data as ApiHousehold
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createHousehold(data: HouseholdData): Promise<ApiHousehold> {
  try {
    const payload = { ...sanitize(data), data_set: 'BIPS' }
    let result: ApiHousehold
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiHousehold>(payload)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(payload).select().single()
      if (error) throw error
      result = row as ApiHousehold
    }
    createActivity('create', COLLECTION, result.id, `Created household: ${result.household_number} — ${result.household_name}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function updateHousehold(id: string, data: Partial<HouseholdData>): Promise<ApiHousehold> {
  try {
    const payload = { ...sanitize(data), data_set: 'BIPS' }
    let result: ApiHousehold
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiHousehold>(id, payload)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(payload).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiHousehold
    }
    createActivity('update', COLLECTION, id, `Updated household: ${result.household_number} — ${result.household_name}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

/**
 * Fix M2: Strip _other fields when their parent field isn't "Others".
 * This prevents inconsistent data even if the UI fails to sanitize.
 */
function sanitize(data: Partial<HouseholdData>): Partial<HouseholdData> {
  const out = { ...data }
  if (out.household_type !== 'Others') delete out.household_type_other
  if (out.tenure_status !== 'Others') delete out.tenure_status_other
  if (out.household_unit !== 'Others') delete out.household_unit_other
  return out
}

export async function deleteHousehold(id: string): Promise<boolean> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createActivity('delete', COLLECTION, id, 'Deleted household')
    return true
  } catch (err) {
    throw handleApiError(err)
  }
}
