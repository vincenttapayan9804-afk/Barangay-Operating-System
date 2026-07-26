import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { updateHousehold } from './households'
import type { BaseRecord } from './types'

export interface HouseholdMemberData {
  household_id: string
  last_name: string
  first_name: string
  middle_name?: string
  ext_name?: string
  resident_id?: string
  relationship_to_head: string
  source_of_income?: string
  monthly_income?: number
  sort_order?: number
  data_set?: string
}

export interface ApiHouseholdMember extends BaseRecord, HouseholdMemberData {
  resident_id: string
}

export async function getHouseholdMembers(householdId: string): Promise<ApiHouseholdMember[]> {
  try {
    if (isDemoModeEnabled()) {
      const filter = getClient().filter('household_id = {:id}', { id: householdId })
      return await getClient().collection('household_members').getFullList<ApiHouseholdMember>({ filter, sort: 'sort_order' })
    }
    const { data, error } = await getSupabase().from('household_members').select('*').eq('household_id', householdId).order('sort_order')
    if (error) throw error
    return data as ApiHouseholdMember[]
  } catch (err) { throw handleApiError(err) }
}

export async function createHouseholdMember(data: HouseholdMemberData): Promise<ApiHouseholdMember> {
  try {
    // Fix M3: Reject if trying to add a second Household Head (code "1")
    if (data.relationship_to_head === '1') {
      const existing = await getHouseholdMembers(data.household_id)
      const hasHead = existing.some((m) => m.relationship_to_head === '1')
      if (hasHead) {
        throw new Error('This household already has a Household Head (relationship code 1). Remove the existing head first.')
      }
    }

    const payload = { ...data, data_set: 'BIPS' }
    let created: ApiHouseholdMember
    if (isDemoModeEnabled()) {
      created = await getClient().collection('household_members').create<ApiHouseholdMember>(payload)
    } else {
      const { data: row, error } = await getSupabase().from('household_members').insert(payload).select().single()
      if (error) throw error
      created = row as ApiHouseholdMember
    }

    // Fix M4: Recalc count after adding a member
    const all = await getHouseholdMembers(data.household_id)
    await updateHousehold(data.household_id, { no_of_household_members: all.length })

    return created
  } catch (err) { throw handleApiError(err) }
}

export async function updateHouseholdMember(id: string, data: Partial<HouseholdMemberData>): Promise<ApiHouseholdMember> {
  try {
    // Fix M3: Enforce single head on code change TO "1"
    if (data.relationship_to_head === '1') {
      let currentHouseholdId: string
      if (isDemoModeEnabled()) {
        const current = await getClient().collection('household_members').getOne<ApiHouseholdMember>(id)
        currentHouseholdId = current.household_id
      } else {
        const { data: current, error } = await getSupabase().from('household_members').select('*').eq('id', id).single()
        if (error) throw error
        currentHouseholdId = (current as ApiHouseholdMember).household_id
      }
      const existing = await getHouseholdMembers(currentHouseholdId)
      const hasOtherHead = existing.some((m) => m.relationship_to_head === '1' && m.id !== id)
      if (hasOtherHead) {
        throw new Error('This household already has a Household Head (relationship code 1). Remove the existing head first.')
      }
    }

    if (isDemoModeEnabled()) {
      return await getClient().collection('household_members').update<ApiHouseholdMember>(id, data)
    }
    const { data: row, error } = await getSupabase().from('household_members').update(data).eq('id', id).select().single()
    if (error) throw error
    return row as ApiHouseholdMember
  } catch (err) { throw handleApiError(err) }
}

export async function deleteHouseholdMember(id: string): Promise<boolean> {
  try {
    // Fetch the record before deleting (to get household_id for recalc + resident_id for cascade)
    let hhId: string
    let residentId: string | undefined

    if (isDemoModeEnabled()) {
      const record = await getClient().collection('household_members').getOne<ApiHouseholdMember>(id)
      hhId = record.household_id
      residentId = record.resident_id

      await getClient().collection('household_members').delete(id)

      if (residentId) {
        try {
          await getClient().collection('residents').update(residentId, { household_id: '' })
        } catch { /* resident may not exist — ignore */ }
      }
    } else {
      const { data: record, error: getErr } = await getSupabase().from('household_members').select('*').eq('id', id).single()
      if (getErr) throw getErr
      hhId = (record as ApiHouseholdMember).household_id
      residentId = (record as ApiHouseholdMember).resident_id

      const { error: delErr } = await getSupabase().from('household_members').delete().eq('id', id)
      if (delErr) throw delErr

      if (residentId) {
        try {
          const { error: updErr } = await getSupabase().from('residents').update({ household_id: null }).eq('id', residentId)
          if (updErr) throw updErr
        } catch { /* resident may not exist — ignore */ }
      }
    }

    // Fix M4: Recalc count after deleting a member
    if (hhId) {
      const remaining = await getHouseholdMembers(hhId)
      await updateHousehold(hhId, { no_of_household_members: remaining.length })
    }

    return true
  } catch (err) { throw handleApiError(err) }
}
