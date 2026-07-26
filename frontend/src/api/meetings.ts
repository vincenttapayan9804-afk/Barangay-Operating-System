import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { createActivity } from './activity'
import { getAgendaItems, type ApiAgendaItem } from './agenda'
import { orIlike } from './supabaseFilters'
import type { BaseRecord } from './types'
import type { PaginatedResult } from '@/lib/utils'

const COLLECTION = 'meetings'

export interface MeetingData {
  title: string
  meeting_date: string
  location?: string
  meeting_type: string
  status: string
  notes?: string
}

export interface ApiMeeting extends BaseRecord, MeetingData {}

export interface MeetingWithItems extends ApiMeeting {
  agendaItems: ApiAgendaItem[]
}

export async function getMeetings(): Promise<ApiMeeting[]> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getFullList<ApiMeeting>({ sort: '-meeting_date' })
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').order('meeting_date', { ascending: false })
    if (error) throw error
    return data as ApiMeeting[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getMeeting(id: string): Promise<MeetingWithItems> {
  try {
    let meeting: ApiMeeting
    if (isDemoModeEnabled()) {
      meeting = await getClient().collection(COLLECTION).getOne<ApiMeeting>(id)
    } else {
      const { data, error } = await getSupabase().from(COLLECTION).select('*').eq('id', id).single()
      if (error) throw error
      meeting = data as ApiMeeting
    }
    const agendaItems = await getAgendaItems(id)
    return { ...meeting, agendaItems }
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createMeeting(data: MeetingData): Promise<ApiMeeting> {
  try {
    let result: ApiMeeting
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiMeeting>(data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(data).select().single()
      if (error) throw error
      result = row as ApiMeeting
    }
    createActivity('create', COLLECTION, result.id, `Created meeting: ${result.title} (${result.meeting_type})`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function updateMeeting(id: string, data: Partial<MeetingData>): Promise<ApiMeeting> {
  try {
    let result: ApiMeeting
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiMeeting>(id, data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(data).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiMeeting
    }
    createActivity('update', COLLECTION, id, `Updated meeting: ${result.title} — status: ${result.status}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function deleteMeeting(id: string): Promise<boolean> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).getOne<ApiMeeting>(id)
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createActivity('delete', COLLECTION, id, 'Deleted meeting')
    return true
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getMeetingsPage(
  page = 1,
  perPage = 25,
  options: { search?: string; status?: string } = {},
): Promise<PaginatedResult<ApiMeeting>> {
  try {
    if (isDemoModeEnabled()) {
      const filters: string[] = []
      if (options.search) filters.push(getClient().filter('title ~ {:q}', { q: options.search }))
      if (options.status) filters.push(getClient().filter('status = {:s}', { s: options.status }))
      const query: Record<string, unknown> = { sort: '-meeting_date' }
      if (filters.length > 0) query.filter = filters.join(' && ')
      const result = await getClient().collection(COLLECTION).getList<ApiMeeting>(page, perPage, query)
      return { items: result.items, totalItems: result.totalItems, totalPages: result.totalPages }
    }

    let q = getSupabase().from(COLLECTION).select('*', { count: 'exact' })
    if (options.search) q = q.or(orIlike(['title'], options.search))
    if (options.status) q = q.eq('status', options.status)
    const from = (page - 1) * perPage
    const { data, error, count } = await q.order('meeting_date', { ascending: false }).range(from, from + perPage - 1)
    if (error) throw error
    const totalItems = count ?? 0
    return { items: data as ApiMeeting[], totalItems, totalPages: Math.max(1, Math.ceil(totalItems / perPage)) }
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getUpcomingMeetings(): Promise<ApiMeeting[]> {
  try {
    const today = new Date().toISOString().split('T')[0]
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getFullList<ApiMeeting>({
        filter: getClient().filter('meeting_date >= {:today}', { today }),
        sort: 'meeting_date',
      })
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').gte('meeting_date', today).order('meeting_date')
    if (error) throw error
    return data as ApiMeeting[]
  } catch (err) {
    throw handleApiError(err)
  }
}
