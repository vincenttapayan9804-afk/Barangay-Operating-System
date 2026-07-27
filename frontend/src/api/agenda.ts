import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { createActivity } from './activity'
import type { BaseRecord } from './types'

const COLLECTION = 'agenda_items'

export interface AgendaItemData {
  meeting_id: string
  title: string
  description?: string
  sort_order?: number
  status: string
  minutes?: string
  submitted_by?: string
}

export interface ApiAgendaItem extends BaseRecord, AgendaItemData {}

export async function getAgendaItems(meetingId: string): Promise<ApiAgendaItem[]> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getFullList<ApiAgendaItem>({
        filter: getClient().filter('meeting_id = {:m}', { m: meetingId }),
        sort: 'sort_order',
      })
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').eq('meeting_id', meetingId).order('sort_order')
    if (error) throw error
    return data as ApiAgendaItem[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createAgendaItem(data: AgendaItemData): Promise<ApiAgendaItem> {
  try {
    let result: ApiAgendaItem
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiAgendaItem>(data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(data).select().single()
      if (error) throw error
      result = row as ApiAgendaItem
    }
    createActivity('create', COLLECTION, result.id, `Created agenda item: ${result.title}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function updateAgendaItem(id: string, data: Partial<AgendaItemData>): Promise<ApiAgendaItem> {
  try {
    let result: ApiAgendaItem
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiAgendaItem>(id, data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(data).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiAgendaItem
    }
    createActivity('update', COLLECTION, id, `Updated agenda item: ${result.title}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function deleteAgendaItem(id: string): Promise<boolean> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).getOne<ApiAgendaItem>(id)
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createActivity('delete', COLLECTION, id, 'Deleted agenda item')
    return true
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function reorderAgendaItems(items: { id: string; sort_order: number }[]): Promise<void> {
  try {
    if (isDemoModeEnabled()) {
      await Promise.all(items.map((item) => getClient().collection(COLLECTION).update(item.id, { sort_order: item.sort_order })))
    } else {
      const supabase = getSupabase()
      await Promise.all(
        items.map(async (item) => {
          const { error } = await supabase.from(COLLECTION).update({ sort_order: item.sort_order }).eq('id', item.id)
          if (error) throw error
        }),
      )
    }
    createActivity('update', COLLECTION, 'reorder', `Reordered ${items.length} agenda items`)
  } catch (err) {
    throw handleApiError(err)
  }
}
