import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { getCurrentUser } from '@/auth/session'
import { handleApiError } from './errorHandler'
import type { BaseRecord } from './types'

export interface ApiFinanceAudit extends BaseRecord {
  action: string
  collection_name: string
  record_id: string
  details: string
  amount: number
  user_name: string
  created: string
}

export async function getFinanceAuditLogs(
  page = 1,
  perPage = 25,
  sort = '-created',
  collectionName?: string,
): Promise<{ items: ApiFinanceAudit[]; totalItems: number; totalPages: number }> {
  try {
    if (isDemoModeEnabled()) {
      const filters: string[] = []
      if (collectionName) filters.push(getClient().filter('collection_name = {:c}', { c: collectionName }))
      const options: Record<string, unknown> = { sort }
      if (filters.length > 0) options.filter = filters.join(' && ')
      const result = await getClient().collection('finance_audit_logs').getList<ApiFinanceAudit>(page, perPage, options)
      return { items: result.items, totalItems: result.totalItems, totalPages: result.totalPages }
    }

    let q = getSupabase().from('finance_audit_logs').select('*', { count: 'exact' })
    if (collectionName) q = q.eq('collection_name', collectionName)
    const ascending = !sort.startsWith('-')
    const field = sort.replace(/^-/, '')
    const from = (page - 1) * perPage
    const { data, error, count } = await q.order(field, { ascending }).range(from, from + perPage - 1)
    if (error) throw error
    const totalItems = count ?? 0
    return { items: data as ApiFinanceAudit[], totalItems, totalPages: Math.max(1, Math.ceil(totalItems / perPage)) }
  } catch (err) {
    throw handleApiError(err)
  }
}

export async function createFinanceAuditLog(
  action: 'create' | 'update' | 'delete',
  collectionName: string,
  recordId: string,
  details: string,
  amount = 0,
): Promise<void> {
  try {
    if (isDemoModeEnabled()) {
      const user = getClient().authStore.model as Record<string, unknown> | null
      const userName = (user?.name as string) ?? (user?.email as string) ?? 'System'
      await getClient().collection('finance_audit_logs').create({
        action,
        collection_name: collectionName,
        record_id: recordId,
        details,
        amount,
        user_name: userName,
      })
      return
    }

    const user = getCurrentUser()
    const userName = user?.name ?? user?.email ?? 'System'
    await getSupabase().from('finance_audit_logs').insert({
      action,
      collection_name: collectionName,
      record_id: recordId,
      details,
      amount,
      user_name: userName,
    })
  } catch {
    // Silent - audit failure should not block the main operation
  }
}
