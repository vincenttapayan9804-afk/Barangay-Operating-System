import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import type { BaseRecord } from './types'

export interface DeceasedRecordData {
  inhabitant_id: string
  date_of_death: string
  immediate_cause_of_death: string
  underlying_cause_of_death: string
  underlying_cause_other?: string
  data_set?: string
}

export interface ApiDeceasedRecord extends BaseRecord, DeceasedRecordData {}

export async function getDeceasedRecords(): Promise<ApiDeceasedRecord[]> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection('deceased_records').getFullList<ApiDeceasedRecord>({ sort: '-created' })
    }
    const { data, error } = await getSupabase().from('deceased_records').select('*').order('created', { ascending: false })
    if (error) throw error
    return data as ApiDeceasedRecord[]
  } catch (err) { throw handleApiError(err) }
}

export async function createDeceasedRecord(data: DeceasedRecordData): Promise<ApiDeceasedRecord> {
  try {
    const payload = { ...data, data_set: 'BIPS' }
    if (isDemoModeEnabled()) {
      const result = await getClient().collection('deceased_records').create<ApiDeceasedRecord>(payload)
      await getClient().collection('residents').update(data.inhabitant_id, { is_deceased: true })
      return result
    }
    const { data: row, error } = await getSupabase().from('deceased_records').insert(payload).select().single()
    if (error) throw error
    const { error: updErr } = await getSupabase().from('residents').update({ is_deceased: true }).eq('id', data.inhabitant_id)
    if (updErr) throw updErr
    return row as ApiDeceasedRecord
  } catch (err) { throw handleApiError(err) }
}

export async function updateDeceasedRecord(id: string, data: Partial<DeceasedRecordData>): Promise<ApiDeceasedRecord> {
  try {
    const payload = { ...data, data_set: 'BIPS' }
    if (isDemoModeEnabled()) {
      return await getClient().collection('deceased_records').update<ApiDeceasedRecord>(id, payload)
    }
    const { data: row, error } = await getSupabase().from('deceased_records').update(payload).eq('id', id).select().single()
    if (error) throw error
    return row as ApiDeceasedRecord
  } catch (err) { throw handleApiError(err) }
}

export async function deleteDeceasedRecord(id: string): Promise<boolean> {
  try {
    if (isDemoModeEnabled()) {
      const record = await getClient().collection('deceased_records').getOne<ApiDeceasedRecord>(id)
      await getClient().collection('deceased_records').delete(id)
      const remaining = await getClient().collection('deceased_records').getFullList({
        filter: getClient().filter('inhabitant_id = {:id}', { id: record.inhabitant_id }),
      })
      if (remaining.length === 0) {
        await getClient().collection('residents').update(record.inhabitant_id, { is_deceased: false })
      }
      return true
    }

    const { data: record, error: getErr } = await getSupabase().from('deceased_records').select('*').eq('id', id).single()
    if (getErr) throw getErr
    const inhabitantId = (record as ApiDeceasedRecord).inhabitant_id
    const { error: delErr } = await getSupabase().from('deceased_records').delete().eq('id', id)
    if (delErr) throw delErr
    const { data: remaining, error: remErr } = await getSupabase().from('deceased_records').select('id').eq('inhabitant_id', inhabitantId)
    if (remErr) throw remErr
    if ((remaining ?? []).length === 0) {
      const { error: updErr } = await getSupabase().from('residents').update({ is_deceased: false }).eq('id', inhabitantId)
      if (updErr) throw updErr
    }
    return true
  } catch (err) { throw handleApiError(err) }
}
