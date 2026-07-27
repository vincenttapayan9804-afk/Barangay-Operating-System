import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import type { ApiFundSource } from './fundSources'
import { getCurrentUser } from '@/auth/session'
import { createFinanceAuditLog } from './financeAudit'
import { createActivity } from './activity'
import type { BaseRecord } from './types'

const COLLECTION = 'appropriations'

export interface AppropriationData {
  fiscal_year?: number
  fund_source?: string
  expense_class?: 'PS' | 'MOOE' | 'CO'
  item_name?: string
  appropriated_amount?: number
  disbursed_amount?: number
  payee?: string
  obligated_date?: string
  fully_disbursed_date?: string
  obligation_notes?: string
  notes?: string
}

export interface ApiAppropriation extends BaseRecord {
  fiscal_year: number
  fund_source: string
  expense_class: 'PS' | 'MOOE' | 'CO'
  item_name: string
  appropriated_amount: number
  disbursed_amount: number
  payee: string
  obligated_date: string
  fully_disbursed_date: string
  obligation_notes: string
  notes: string
  created_by?: string
  expand?: { fund_source?: ApiFundSource }
}

// PostgREST embeds the joined row under the target table's name (or an
// alias) — never the FK column's own name, since that column still holds
// the raw uuid in the same response. Re-shaping into `{ ...row, expand }`
// here keeps every caller (features/finance/Appropriations.tsx) written
// against the same `record.expand.fund_source` shape PocketBase's `expand`
// option produced, so nothing downstream needs to change.
function withExpand(row: Record<string, unknown>): ApiAppropriation {
  const { _fund_source_expand, ...rest } = row as { _fund_source_expand?: ApiFundSource }
  return { ...rest, expand: _fund_source_expand ? { fund_source: _fund_source_expand } : undefined } as ApiAppropriation
}

export async function getAppropriations(fiscalYear?: number): Promise<ApiAppropriation[]> {
  try {
    if (isDemoModeEnabled()) {
      const filter = fiscalYear ? getClient().filter('fiscal_year={:y}', { y: fiscalYear }) : ''
      return await getClient().collection(COLLECTION).getFullList({ filter, sort: '-id', expand: 'fund_source' })
    }
    let q = getSupabase().from(COLLECTION).select('*, _fund_source_expand:fund_sources(*)')
    if (fiscalYear) q = q.eq('fiscal_year', fiscalYear)
    const { data, error } = await q.order('id', { ascending: false })
    if (error) throw error
    return (data as Record<string, unknown>[]).map(withExpand)
  } catch (e) { throw handleApiError(e) }
}

export async function getAppropriation(id: string): Promise<ApiAppropriation> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getOne(id, { expand: 'fund_source' })
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*, _fund_source_expand:fund_sources(*)').eq('id', id).single()
    if (error) throw error
    return withExpand(data as Record<string, unknown>)
  }
  catch (e) { throw handleApiError(e) }
}

export async function markAppropriationAsObligated(id: string, data: { payee: string; obligated_date: string; obligation_notes?: string }): Promise<ApiAppropriation> {
  try {
    const payload = { payee: data.payee, obligated_date: data.obligated_date, obligation_notes: data.obligation_notes || '' }
    let result: ApiAppropriation
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiAppropriation>(id, payload)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(payload).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiAppropriation
    }
    createFinanceAuditLog('update', COLLECTION, id, `marked appropriation as obligated: ${result.item_name} → ${data.payee}`)
    createActivity('update', COLLECTION, id, `Marked appropriation as obligated: ${result.item_name}`)
    return result
  }
  catch (e) { throw handleApiError(e) }
}

export async function createAppropriation(data: AppropriationData): Promise<ApiAppropriation> {
  try {
    const payload = { ...data, disbursed_amount: 0, created_by: getCurrentUser()?.id }
    let result: ApiAppropriation
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiAppropriation>(payload)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(payload).select().single()
      if (error) throw error
      result = row as ApiAppropriation
    }
    createFinanceAuditLog('create', COLLECTION, result.id, `created appropriations: ${result.item_name}`, result.appropriated_amount)
    createActivity('create', COLLECTION, result.id, `Created appropriation: ${result.item_name} (${result.expense_class})`)
    return result
  }
  catch (e) { throw handleApiError(e) }
}

export async function updateAppropriation(id: string, data: Partial<AppropriationData>): Promise<ApiAppropriation> {
  try {
    let result: ApiAppropriation
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiAppropriation>(id, data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(data).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiAppropriation
    }
    createFinanceAuditLog('update', COLLECTION, result.id, `updated appropriations: ${result.item_name}`, result.appropriated_amount)
    createActivity('update', COLLECTION, id, `Updated appropriation: ${result.item_name}`)
    return result
  }
  catch (e) { throw handleApiError(e) }
}

export async function deleteAppropriation(id: string): Promise<boolean> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createFinanceAuditLog('delete', COLLECTION, id, `deleted appropriations`)
    createActivity('delete', COLLECTION, id, 'Deleted appropriation')
    return true
  }
  catch (e) { throw handleApiError(e) }
}
