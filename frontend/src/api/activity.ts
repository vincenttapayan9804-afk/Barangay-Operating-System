import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { getCurrentUser } from '@/auth/session'
import { handleApiError } from './errorHandler'
import { redactSensitiveText } from '@/lib/dlp'
import type { BaseRecord } from './types'

export interface ApiActivity extends BaseRecord {
  action: string
  collection: string
  record_id: string
  details: string
  user_name: string
  created: string
}

export async function getActivities(
  page = 1,
  perPage = 25,
  sort = '-id',
  collection?: string,
  recordId?: string,
): Promise<{ items: ApiActivity[]; totalItems: number; totalPages: number }> {
  try {
    if (isDemoModeEnabled()) {
      const filters: string[] = []
      if (collection) filters.push(getClient().filter('collection = {:c}', { c: collection }))
      if (recordId) filters.push(getClient().filter('record_id = {:r}', { r: recordId }))
      const options: Record<string, unknown> = { sort }
      if (filters.length > 0) options.filter = filters.join(' && ')
      const result = await getClient().collection('activity_logs').getList<ApiActivity>(page, perPage, options)
      return { items: result.items, totalItems: result.totalItems, totalPages: result.totalPages }
    }

    let q = getSupabase().from('activity_logs').select('*', { count: 'exact' })
    if (collection) q = q.eq('collection', collection)
    if (recordId) q = q.eq('record_id', recordId)
    const ascending = !sort.startsWith('-')
    const field = sort.replace(/^-/, '')
    const from = (page - 1) * perPage
    const { data, error, count } = await q.order(field, { ascending }).range(from, from + perPage - 1)
    if (error) throw error
    const totalItems = count ?? 0
    return { items: data as ApiActivity[], totalItems, totalPages: Math.max(1, Math.ceil(totalItems / perPage)) }
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createActivity(
  action: 'create' | 'update' | 'delete',
  collection: string,
  recordId: string,
  details: string,
): Promise<void> {
  const safeDetails = redactSensitiveText(details)
  try {
    if (isDemoModeEnabled()) {
      const user = getClient().authStore.model as Record<string, unknown> | null
      const userName = (user?.name as string) ?? (user?.email as string) ?? 'System'
      await getClient().collection('activity_logs').create({
        action,
        collection,
        record_id: recordId,
        details: safeDetails,
        user_name: userName,
      })
      return
    }

    const user = getCurrentUser()
    const userName = user?.name ?? user?.email ?? 'System'
    await getSupabase().from('activity_logs').insert({
      action,
      collection,
      record_id: recordId,
      details: safeDetails,
      user_name: userName,
    })
  } catch {
    // Silent — audit failure should not block the main operation
  }
}
