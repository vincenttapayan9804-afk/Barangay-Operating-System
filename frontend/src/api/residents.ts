import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { createActivity } from './activity'
import { indexResident, deleteResidentFromIndex } from './searchSync'
import { orIlike } from './supabaseFilters'
import type { BaseRecord } from './types'
import type { PaginatedResult } from '@/lib/utils'

const COLLECTION = 'residents'

export interface InhabitantData {
  // Classification
  type_of_resident?: string
  household_id?: string

  // Personal Information
  philsys_card_no?: string
  first_name: string
  last_name: string
  middle_name?: string
  ext_name?: string
  date_of_birth?: string
  place_of_birth?: string
  residence_of_mother_upon_birth?: string
  sex?: string
  gender?: string
  gender_other?: string
  civil_status?: string
  pregnant_woman?: boolean
  highest_educational_attainment?: string
  profession_occupation?: string
  mother_maiden_first_name?: string
  mother_maiden_middle_name?: string
  mother_maiden_last_name?: string

  // Contact Details
  email_address?: string
  mobile_number?: string
  tel_number?: string

  // Address
  region?: string
  province?: string
  city_municipality?: string
  barangay?: string
  sitio_purok?: string
  house_block_lot_no?: string
  street_name?: string
  subdivision_village?: string
  zip_code?: string

  // Identity Information
  blood_type?: string
  height_m?: number
  weight_kg?: number
  complexion?: string
  nationality?: string
  ethnicity?: string
  religion?: string
  religion_other?: string

  // Voter Info
  registered_voter?: boolean
  resident_voter?: boolean
  last_voted_year?: number

  // Beneficiary Info
  government_assistance_programs?: string[]
  government_assistance_other?: string

  // Sectoral Info (all boolean)
  employed?: boolean
  unemployed?: boolean
  ofw?: boolean
  indigenous_people?: boolean
  student?: boolean
  out_of_school_children?: boolean
  out_of_school_youth?: boolean
  migrant?: boolean
  refugee?: boolean
  senior_citizen?: boolean
  pwd?: boolean
  single_solo_parent?: boolean

  // Consent
  data_privacy_consent?: boolean
  consent_signature_date?: string

  // Soft-delete
  is_deceased?: boolean

  // Data set tag
  data_set?: string
}

export interface ApiResident extends BaseRecord {
  // Classification
  type_of_resident: string
  household_id: string

  // Personal Information
  philsys_card_no: string
  first_name: string
  last_name: string
  middle_name: string
  ext_name: string
  date_of_birth: string
  age: number
  place_of_birth: string
  residence_of_mother_upon_birth: string
  sex: string
  gender: string
  gender_other: string
  civil_status: string
  pregnant_woman: boolean
  highest_educational_attainment: string
  profession_occupation: string
  mother_maiden_first_name: string
  mother_maiden_middle_name: string
  mother_maiden_last_name: string

  // Contact Details
  email_address: string
  mobile_number: string
  tel_number: string

  // Address
  region: string
  province: string
  city_municipality: string
  barangay: string
  sitio_purok: string
  house_block_lot_no: string
  street_name: string
  subdivision_village: string
  zip_code: string

  // Identity Information
  blood_type: string
  height_m: number
  weight_kg: number
  complexion: string
  nationality: string
  ethnicity: string
  religion: string
  religion_other: string

  // Voter Info
  registered_voter: boolean
  resident_voter: boolean
  last_voted_year: number

  // Beneficiary Info
  government_assistance_programs: string[]
  government_assistance_other: string

  // Sectoral Info
  employed: boolean
  unemployed: boolean
  ofw: boolean
  indigenous_people: boolean
  student: boolean
  out_of_school_children: boolean
  out_of_school_youth: boolean
  migrant: boolean
  refugee: boolean
  senior_citizen: boolean
  pwd: boolean
  single_solo_parent: boolean

  // Consent
  data_privacy_consent: boolean
  consent_signature_date: string

  // Soft-delete
  is_deceased: boolean
}

export async function searchResidents(query: string): Promise<ApiResident[]> {
  try {
    if (query.length < 3) return []

    if (isDemoModeEnabled()) {
      const filter = getClient().filter('(first_name ~ {:q} || last_name ~ {:q}) && is_deceased = false', { q: query })
      return await getClient().collection(COLLECTION).getFullList<ApiResident>({
        filter,
        sort: 'last_name,first_name',
        perPage: 15,
      })
    }

    const { data, error } = await getSupabase()
      .from(COLLECTION)
      .select('*')
      .or(orIlike(['first_name', 'last_name'], query))
      .eq('is_deceased', false)
      .order('last_name')
      .order('first_name')
      .limit(15)
    if (error) throw error
    return data as ApiResident[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getResidents(params?: { household_id?: string }): Promise<ApiResident[]> {
  try {
    if (isDemoModeEnabled()) {
      const query: Record<string, unknown> = { sort: '-id' }
      if (params?.household_id) {
        query.filter = getClient().filter('household_id = {:id}', { id: params.household_id.trim() })
      }
      return await getClient().collection(COLLECTION).getFullList<ApiResident>(query)
    }

    let q = getSupabase().from(COLLECTION).select('*')
    if (params?.household_id) q = q.eq('household_id', params.household_id.trim())
    const { data, error } = await q.order('id', { ascending: false })
    if (error) throw error
    return data as ApiResident[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getResident(id: string): Promise<ApiResident> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getOne<ApiResident>(id)
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').eq('id', id).single()
    if (error) throw error
    return data as ApiResident
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createResident(data: InhabitantData): Promise<ApiResident> {
  try {
    let result: ApiResident
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiResident>({ ...data, data_set: 'BIPS' })
    } else {
      const { data: row, error } = await getSupabase()
        .from(COLLECTION)
        .insert({ ...data, data_set: 'BIPS' })
        .select()
        .single()
      if (error) throw error
      result = row as ApiResident
    }
    createActivity('create', COLLECTION, result.id, `Created resident: ${result.first_name} ${result.last_name}`)
    indexResident(result)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function updateResident(id: string, data: Partial<InhabitantData>): Promise<ApiResident> {
  try {
    // Cascade: if household_id is being cleared, remove the linked household member record
    if (Object.prototype.hasOwnProperty.call(data, 'household_id') && !data.household_id) {
      try {
        if (isDemoModeEnabled()) {
          const members = await getClient().collection('household_members').getFullList({
            filter: getClient().filter('resident_id = {:id}', { id }),
          })
          for (const m of members) {
            await getClient().collection('household_members').delete(m.id)
          }
        } else {
          const { data: members } = await getSupabase().from('household_members').select('id').eq('resident_id', id)
          for (const m of members ?? []) {
            await getSupabase().from('household_members').delete().eq('id', (m as { id: string }).id)
          }
        }
      } catch { /* ignore cascade errors */ }
    }

    const payload = { ...data, data_set: 'BIPS' } as Record<string, unknown>
    // A relation field needs an explicit null (not undefined/empty string) to clear it.
    if (payload.household_id === undefined || payload.household_id === '') {
      payload.household_id = null
    }

    let result: ApiResident
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiResident>(id, payload)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(payload).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiResident
    }
    createActivity('update', COLLECTION, id, `Updated resident: ${result.first_name} ${result.last_name}`)
    indexResident(result)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function deleteResident(id: string): Promise<boolean> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createActivity('delete', COLLECTION, id, 'Deleted resident')
    deleteResidentFromIndex(id)
    return true
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getResidentsPage(
  page = 1,
  perPage = 25,
  options: { search?: string; sitio_purok?: string; tags?: string[] } = {},
): Promise<PaginatedResult<ApiResident>> {
  try {
    if (isDemoModeEnabled()) {
      const filters: string[] = []
      if (options.search) {
        filters.push(getClient().filter('(first_name ~ {:q} || last_name ~ {:q} || mobile_number ~ {:q})', { q: options.search }))
      }
      if (options.sitio_purok) filters.push(getClient().filter('sitio_purok = {:p}', { p: options.sitio_purok }))
      const query: Record<string, unknown> = { sort: '-id' }
      if (filters.length > 0) query.filter = filters.join(' && ')
      const result = await getClient().collection(COLLECTION).getList<ApiResident>(page, perPage, query)
      return { items: result.items, totalItems: result.totalItems, totalPages: result.totalPages }
    }

    let q = getSupabase().from(COLLECTION).select('*', { count: 'exact' })
    if (options.search) q = q.or(orIlike(['first_name', 'last_name', 'mobile_number'], options.search))
    if (options.sitio_purok) q = q.eq('sitio_purok', options.sitio_purok)
    const from = (page - 1) * perPage
    const { data, error, count } = await q.order('id', { ascending: false }).range(from, from + perPage - 1)
    if (error) throw error
    const totalItems = count ?? 0
    return { items: data as ApiResident[], totalItems, totalPages: Math.max(1, Math.ceil(totalItems / perPage)) }
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getResidentsSummary(): Promise<{
  total: number
  voters: number
  seniors: number
  pwd: number
  registered_voters: number
}> {
  try {
    let all: ApiResident[]
    if (isDemoModeEnabled()) {
      all = await getClient().collection(COLLECTION).getFullList<ApiResident>({ requestKey: 'residents-summary' })
    } else {
      const { data, error } = await getSupabase().from(COLLECTION).select('*')
      if (error) throw error
      all = data as ApiResident[]
    }
    return {
      total: all.length,
      voters: all.filter((r) => r.registered_voter).length,
      registered_voters: all.filter((r) => r.registered_voter).length,
      seniors: all.filter((r) => r.senior_citizen).length,
      pwd: all.filter((r) => r.pwd).length,
    }
  } catch {
    return { total: 0, voters: 0, seniors: 0, pwd: 0, registered_voters: 0 }
  }
}
