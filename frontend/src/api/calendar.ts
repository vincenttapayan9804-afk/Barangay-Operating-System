import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { createActivity } from './activity'
import type { BaseRecord } from './types'

const COLLECTION = 'calendar_events'

export interface CalendarEventData {
  title: string
  description?: string
  event_type: string
  start_datetime: string
  end_datetime?: string
  all_day?: boolean
  location?: string
  agenda_ref?: string
  notes?: string
}

export interface ApiCalendarEvent extends BaseRecord, CalendarEventData {}

export async function getEvents(): Promise<ApiCalendarEvent[]> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getFullList<ApiCalendarEvent>({ sort: 'start_datetime' })
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').order('start_datetime')
    if (error) throw error
    return data as ApiCalendarEvent[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getEventsByMonth(year: number, month: number): Promise<ApiCalendarEvent[]> {
  try {
    const pad = (n: number) => n.toString().padStart(2, '0')
    const start = `${year}-${pad(month)}-01`
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    const end = `${nextYear}-${pad(nextMonth)}-01`

    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getFullList<ApiCalendarEvent>({
        sort: 'start_datetime',
        filter: getClient().filter('start_datetime >= {:start} && start_datetime < {:end}', { start, end }),
      })
    }

    const { data, error } = await getSupabase()
      .from(COLLECTION)
      .select('*')
      .gte('start_datetime', start)
      .lt('start_datetime', end)
      .order('start_datetime')
    if (error) throw error
    return data as ApiCalendarEvent[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getEvent(id: string): Promise<ApiCalendarEvent> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getOne<ApiCalendarEvent>(id)
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').eq('id', id).single()
    if (error) throw error
    return data as ApiCalendarEvent
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createEvent(data: CalendarEventData): Promise<ApiCalendarEvent> {
  try {
    let result: ApiCalendarEvent
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiCalendarEvent>(data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(data).select().single()
      if (error) throw error
      result = row as ApiCalendarEvent
    }
    createActivity('create', COLLECTION, result.id, `Created event: ${result.title}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function updateEvent(id: string, data: Partial<CalendarEventData>): Promise<ApiCalendarEvent> {
  try {
    let result: ApiCalendarEvent
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiCalendarEvent>(id, data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(data).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiCalendarEvent
    }
    createActivity('update', COLLECTION, id, `Updated event: ${result.title}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function deleteEvent(id: string): Promise<boolean> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).getOne<ApiCalendarEvent>(id)
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createActivity('delete', COLLECTION, id, 'Deleted event')
    return true
  } catch (err) {
    throw handleApiError(err)
  }
}
