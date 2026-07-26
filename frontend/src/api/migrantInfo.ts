import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { updateHousehold } from './households'
import type { BaseRecord } from './types'

export interface MigrantData {
  household_id: string
  last_name: string
  first_name: string
  middle_name?: string
  ext_name?: string
  previous_residence: string
  length_of_stay_previous_barangay: string
  reason_for_leaving: string
  reason_for_leaving_other?: string
  date_of_transfer: string
  reason_for_transferring: string
  reason_for_transferring_other?: string
  duration_of_stay_current_barangay: string
  intention_to_return: boolean
  data_set?: string
}

export interface ApiMigrant extends BaseRecord, MigrantData {}

export async function getMigrants(householdId: string): Promise<ApiMigrant[]> {
  try {
    if (isDemoModeEnabled()) {
      const filter = getClient().filter('household_id = {:id}', { id: householdId })
      return await getClient().collection('migrant_info').getFullList<ApiMigrant>({ filter })
    }
    const { data, error } = await getSupabase().from('migrant_info').select('*').eq('household_id', householdId)
    if (error) throw error
    return data as ApiMigrant[]
  } catch (err) { throw handleApiError(err) }
}

export async function createMigrant(data: MigrantData): Promise<ApiMigrant> {
  try {
    // Fix M2: Strip _other fields when their parent code isn't the extensibility value
    const clean = { ...sanitizeMigrant(data), data_set: 'BIPS' }

    let created: ApiMigrant
    if (isDemoModeEnabled()) {
      created = await getClient().collection('migrant_info').create<ApiMigrant>(clean)
    } else {
      const { data: row, error } = await getSupabase().from('migrant_info').insert(clean).select().single()
      if (error) throw error
      created = row as ApiMigrant
    }

    // Fix M4: Recalc migrant count after adding
    const all = await getMigrants(data.household_id)
    await updateHousehold(data.household_id, { no_of_migrants: all.length })

    return created
  } catch (err) { throw handleApiError(err) }
}

export async function updateMigrant(id: string, data: Partial<MigrantData>): Promise<ApiMigrant> {
  try {
    // Fix M2: Strip _other fields when their parent code isn't the extensibility value
    const clean = sanitizeMigrant(data as MigrantData)

    if (isDemoModeEnabled()) {
      return await getClient().collection('migrant_info').update<ApiMigrant>(id, clean)
    }
    const { data: row, error } = await getSupabase().from('migrant_info').update(clean).eq('id', id).select().single()
    if (error) throw error
    return row as ApiMigrant
  } catch (err) { throw handleApiError(err) }
}

export async function deleteMigrant(id: string): Promise<boolean> {
  try {
    let hhId: string
    if (isDemoModeEnabled()) {
      const record = await getClient().collection('migrant_info').getOne<ApiMigrant>(id)
      hhId = record.household_id
      await getClient().collection('migrant_info').delete(id)
    } else {
      const { data: record, error: getErr } = await getSupabase().from('migrant_info').select('*').eq('id', id).single()
      if (getErr) throw getErr
      hhId = (record as ApiMigrant).household_id
      const { error: delErr } = await getSupabase().from('migrant_info').delete().eq('id', id)
      if (delErr) throw delErr
    }

    // Fix M4: Recalc migrant count after deleting
    if (hhId) {
      const remaining = await getMigrants(hhId)
      await updateHousehold(hhId, { no_of_migrants: remaining.length })
    }

    return true
  } catch (err) { throw handleApiError(err) }
}

/**
 * Fix M2: Strip reason_for_leaving_other / reason_for_transferring_other
 * when their parent field code isn't the extensibility value (16 / 5).
 */
function sanitizeMigrant(data: MigrantData): MigrantData {
  const out = { ...data }
  if (out.reason_for_leaving !== '16') delete out.reason_for_leaving_other
  if (out.reason_for_transferring !== '5') delete out.reason_for_transferring_other
  return out
}
