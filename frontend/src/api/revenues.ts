import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import type { ApiIncomeAccount } from './incomeAccounts'
import type { ApiFundSource } from './fundSources'
import type { ApiDocument } from './documents'
import { deductFundSourceBalance, restoreFundSourceBalance } from './fundSources'
import { getCurrentUser } from '@/auth/session'
import { createFinanceAuditLog } from './financeAudit'
import { createActivity } from './activity'
import type { BaseRecord } from './types'

const COLLECTION = 'revenues'

export type RevenueCategory = 'nta_receipt' | 'tax_receipt' | 'other_receipt' | 'document_fee' | 'donation' | 'grant' | 'other'

export interface RevenueData {
  revenue_date?: string
  income_account?: string
  fund_source?: string
  category?: RevenueCategory
  source?: string
  amount?: number
  document_request?: string
  or_no?: string
  remarks?: string
}

export interface ApiRevenue extends BaseRecord {
  revenue_date: string
  income_account: string
  // Plain text, NOT a relation (see migrations/0022_revenues.sql) — distinct
  // from appropriations.fund_source, which is a real FK. Never expandable.
  fund_source: string
  category: RevenueCategory
  source: string
  amount: number
  document_request: string
  or_no: string
  remarks: string
  created_by?: string
  expand?: { income_account?: ApiIncomeAccount; document_request?: ApiDocument; fund_source?: ApiFundSource }
}

function withExpand(row: Record<string, unknown>): ApiRevenue {
  const { _income_account_expand, _document_request_expand, ...rest } = row as {
    _income_account_expand?: ApiIncomeAccount
    _document_request_expand?: ApiDocument
  }
  return {
    ...rest,
    expand: (_income_account_expand || _document_request_expand)
      ? { income_account: _income_account_expand, document_request: _document_request_expand }
      : undefined,
  } as ApiRevenue
}

const EXPAND_SELECT = '*, _income_account_expand:income_accounts(*), _document_request_expand:document_requests(*)'

export async function getRevenues(startDate?: string, endDate?: string, category?: string): Promise<ApiRevenue[]> {
  try {
    if (isDemoModeEnabled()) {
      const filters: string[] = []
      if (startDate) filters.push(getClient().filter('revenue_date >= {:d}', { d: startDate }))
      if (endDate) filters.push(getClient().filter('revenue_date <= {:d}', { d: endDate }))
      if (category && category !== 'all') filters.push(getClient().filter('category={:c}', { c: category }))
      const filter = filters.join(' && ')
      return await getClient().collection(COLLECTION).getFullList<ApiRevenue>({ filter, sort: '-revenue_date', expand: 'income_account,document_request,fund_source' })
    }
    let q = getSupabase().from(COLLECTION).select(EXPAND_SELECT)
    if (startDate) q = q.gte('revenue_date', startDate)
    if (endDate) q = q.lte('revenue_date', endDate)
    if (category && category !== 'all') q = q.eq('category', category)
    const { data, error } = await q.order('revenue_date', { ascending: false })
    if (error) throw error
    return (data as Record<string, unknown>[]).map(withExpand)
  } catch (e) { throw handleApiError(e) }
}

export async function getRevenue(id: string): Promise<ApiRevenue> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getOne<ApiRevenue>(id, { expand: 'income_account,document_request,fund_source' })
    }
    const { data, error } = await getSupabase().from(COLLECTION).select(EXPAND_SELECT).eq('id', id).single()
    if (error) throw error
    return withExpand(data as Record<string, unknown>)
  }
  catch (e) { throw handleApiError(e) }
}

export async function getRevenuesByFundSource(fundSourceId: string): Promise<ApiRevenue[]> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getFullList<ApiRevenue>({
        filter: getClient().filter('fund_source = {:fs}', { fs: fundSourceId }),
        sort: '-revenue_date',
        expand: 'income_account,fund_source',
      })
    }
    const { data, error } = await getSupabase()
      .from(COLLECTION)
      .select('*, _income_account_expand:income_accounts(*)')
      .eq('fund_source', fundSourceId)
      .order('revenue_date', { ascending: false })
    if (error) throw error
    return (data as Record<string, unknown>[]).map((row) => {
      const { _income_account_expand, ...rest } = row as { _income_account_expand?: ApiIncomeAccount }
      return { ...rest, expand: _income_account_expand ? { income_account: _income_account_expand } : undefined } as ApiRevenue
    })
  } catch (e) { throw handleApiError(e) }
}

export async function createRevenue(data: RevenueData): Promise<ApiRevenue> {
  try {
    const payload = { ...data, created_by: getCurrentUser()?.id }
    let result: ApiRevenue
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiRevenue>(payload)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(payload).select().single()
      if (error) throw error
      result = row as ApiRevenue
    }
    createFinanceAuditLog('create', COLLECTION, result.id, `created revenues: ${result.source || result.or_no || ''}`, result.amount)
    createActivity('create', COLLECTION, result.id, `Created revenue: ${result.source || result.or_no || ''} — ₱${result.amount}`)
    if (result.fund_source && result.amount > 0) {
      await restoreFundSourceBalance(result.fund_source, result.amount, `revenue: ${result.source}`).catch(() => {})
    }
    return result
  }
  catch (e) { throw handleApiError(e) }
}

export async function updateRevenue(id: string, data: Partial<RevenueData>): Promise<ApiRevenue> {
  try {
    let result: ApiRevenue
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiRevenue>(id, data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(data).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiRevenue
    }
    createFinanceAuditLog('update', COLLECTION, result.id, `updated revenues`, result.amount)
    createActivity('update', COLLECTION, id, `Updated revenue: ₱${result.amount}`)
    return result
  }
  catch (e) { throw handleApiError(e) }
}

export async function deleteRevenue(id: string): Promise<boolean> {
  try {
    const existing = await getRevenue(id)
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createFinanceAuditLog('delete', COLLECTION, id, `deleted revenues`)
    createActivity('delete', COLLECTION, id, 'Deleted revenue')
    if (existing.fund_source && existing.amount > 0) {
      await deductFundSourceBalance(existing.fund_source, existing.amount, `revenue deleted: ${existing.source}`).catch(() => {})
    }
    return true
  }
  catch (e) { throw handleApiError(e) }
}
