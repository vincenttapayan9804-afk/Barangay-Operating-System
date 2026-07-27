import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { getCurrentUser } from '@/auth/session'
import { createFinanceAuditLog } from './financeAudit'
import { createActivity } from './activity'
import type { BaseRecord } from './types'

const COLLECTION = 'income_accounts'

export interface IncomeAccountData {
  coa_code?: string
  name?: string
  fiscal_year?: number
  budgeted_amount?: number
  notes?: string
}

export interface ApiIncomeAccount extends BaseRecord {
  coa_code: string
  name: string
  fiscal_year: number
  budgeted_amount: number
  notes: string
  created_by?: string
}

export async function getIncomeAccounts(fiscalYear?: number): Promise<ApiIncomeAccount[]> {
  try {
    if (isDemoModeEnabled()) {
      const filter = fiscalYear ? getClient().filter('fiscal_year={:y}', { y: fiscalYear }) : ''
      return await getClient().collection(COLLECTION).getFullList<ApiIncomeAccount>({ filter, sort: '-created' })
    }
    let q = getSupabase().from(COLLECTION).select('*')
    if (fiscalYear) q = q.eq('fiscal_year', fiscalYear)
    const { data, error } = await q.order('created', { ascending: false })
    if (error) throw error
    return data as ApiIncomeAccount[]
  } catch (e) { throw handleApiError(e) }
}

export async function getIncomeAccount(id: string): Promise<ApiIncomeAccount> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getOne<ApiIncomeAccount>(id)
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').eq('id', id).single()
    if (error) throw error
    return data as ApiIncomeAccount
  } catch (e) { throw handleApiError(e) }
}

export async function createIncomeAccount(data: IncomeAccountData): Promise<ApiIncomeAccount> {
  try {
    const payload = { ...data, created_by: getCurrentUser()?.id }
    let result: ApiIncomeAccount
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiIncomeAccount>(payload)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(payload).select().single()
      if (error) throw error
      result = row as ApiIncomeAccount
    }
    createFinanceAuditLog('create', COLLECTION, result.id, `created income_accounts: ${result.name}`)
    createActivity('create', COLLECTION, result.id, `Created income account: ${result.name} (${result.coa_code})`)
    return result
  } catch (e) { throw handleApiError(e) }
}

export async function updateIncomeAccount(id: string, data: Partial<IncomeAccountData>): Promise<ApiIncomeAccount> {
  try {
    let result: ApiIncomeAccount
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiIncomeAccount>(id, data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(data).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiIncomeAccount
    }
    createFinanceAuditLog('update', COLLECTION, result.id, `updated income_accounts: ${result.name}`)
    createActivity('update', COLLECTION, id, `Updated income account: ${result.name}`)
    return result
  } catch (e) { throw handleApiError(e) }
}

export async function deleteIncomeAccount(id: string): Promise<boolean> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createFinanceAuditLog('delete', COLLECTION, id, `deleted income_accounts`)
    createActivity('delete', COLLECTION, id, 'Deleted income account')
    return true
  } catch (e) { throw handleApiError(e) }
}
