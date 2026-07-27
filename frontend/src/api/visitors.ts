import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { createActivity } from './activity'
import type { BaseRecord } from './types'

const COLLECTION = 'visitor_logs'

export interface VisitorData {
  visitor_name: string
  contact_number?: string
  purpose: string
  person_to_visit?: string
  time_out?: string
}

export interface ApiVisitor extends BaseRecord {
  visitor_name: string
  contact_number: string
  purpose: string
  person_to_visit: string
  time_in: string
  time_out: string
}

export async function getVisitors(): Promise<ApiVisitor[]> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getFullList<ApiVisitor>({ sort: '-time_in' })
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').order('time_in', { ascending: false })
    if (error) throw error
    return data as ApiVisitor[]
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function getVisitor(id: string): Promise<ApiVisitor> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getOne<ApiVisitor>(id)
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').eq('id', id).single()
    if (error) throw error
    return data as ApiVisitor
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createVisitor(data: VisitorData): Promise<ApiVisitor> {
  try {
    let result: ApiVisitor
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiVisitor>(data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(data).select().single()
      if (error) throw error
      result = row as ApiVisitor
    }
    createActivity('create', COLLECTION, result.id, `Created visitor log: ${result.visitor_name} — ${result.purpose}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function updateVisitor(id: string, data: Partial<VisitorData>): Promise<ApiVisitor> {
  try {
    let result: ApiVisitor
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiVisitor>(id, data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(data).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiVisitor
    }
    createActivity('update', COLLECTION, id, `Updated visitor log: ${result.visitor_name}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function deleteVisitor(id: string): Promise<boolean> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createActivity('delete', COLLECTION, id, 'Deleted visitor log')
    return true
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function checkOutVisitor(id: string): Promise<ApiVisitor> {
  try {
    const time_out = new Date().toISOString()
    let result: ApiVisitor
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiVisitor>(id, { time_out })
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update({ time_out }).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiVisitor
    }
    createActivity('update', COLLECTION, id, `Checked out visitor: ${result.visitor_name}`)
    return result
  } catch (err) {
    throw handleApiError(err)
  }
}
