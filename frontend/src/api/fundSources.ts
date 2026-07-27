import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import { getCurrentUser } from '@/auth/session'
import { createFinanceAuditLog } from './financeAudit'
import { createActivity } from './activity'
import type { BaseRecord } from './types'

const COLLECTION = 'fund_sources'

export interface FundSourceData {
  name?: string
  code?: string
  description?: string
  statutory_rule?: 'none' | '20%_DF' | 'SK' | 'BDRRMF' | 'GAD'
  current_balance?: number
  original_balance?: number
  fiscal_year?: number
  is_active?: boolean
  notes?: string
}

export interface ApiFundSource extends BaseRecord {
  name: string
  code: string
  description: string
  statutory_rule: 'none' | '20%_DF' | 'SK' | 'BDRRMF' | 'GAD'
  current_balance: number
  original_balance: number
  fiscal_year: number
  is_active: boolean
  notes: string
  created_by?: string
}

export async function getFundSources(fiscalYear?: number): Promise<ApiFundSource[]> {
  try {
    if (isDemoModeEnabled()) {
      const filter = fiscalYear ? getClient().filter('fiscal_year={:y}', { y: fiscalYear }) : ''
      return await getClient().collection(COLLECTION).getFullList<ApiFundSource>({ filter, sort: '-id' })
    }
    let q = getSupabase().from(COLLECTION).select('*')
    if (fiscalYear) q = q.eq('fiscal_year', fiscalYear)
    const { data, error } = await q.order('id', { ascending: false })
    if (error) throw error
    return data as ApiFundSource[]
  } catch (e) { throw handleApiError(e) }
}

export async function getFundSource(id: string): Promise<ApiFundSource> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getOne<ApiFundSource>(id)
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*').eq('id', id).single()
    if (error) throw error
    return data as ApiFundSource
  } catch (e) { throw handleApiError(e) }
}

export async function createFundSource(data: FundSourceData): Promise<ApiFundSource> {
  try {
    const payload = { ...data, original_balance: data.original_balance ?? data.current_balance ?? 0, created_by: getCurrentUser()?.id }
    let result: ApiFundSource
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiFundSource>(payload)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(payload).select().single()
      if (error) throw error
      result = row as ApiFundSource
    }
    createFinanceAuditLog('create', COLLECTION, result.id, `created fund_sources: ${result.name}`)
    createActivity('create', COLLECTION, result.id, `Created fund source: ${result.name} (${result.code})`)
    return result
  } catch (e) { throw handleApiError(e) }
}

export async function deductFundSourceBalance(id: string, amount: number, details: string): Promise<ApiFundSource> {
  try {
    const fs = await getFundSource(id)
    const newBalance = (fs.current_balance || 0) - amount
    let result: ApiFundSource
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiFundSource>(id, { current_balance: newBalance })
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update({ current_balance: newBalance }).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiFundSource
    }
    createFinanceAuditLog('update', COLLECTION, id, details, amount)
    createActivity('update', COLLECTION, id, `Deducted from fund source: ₱${amount} — ${details}`)
    return result
  } catch (e) { throw handleApiError(e) }
}

export async function restoreFundSourceBalance(id: string, amount: number, details: string): Promise<ApiFundSource> {
  try {
    const fs = await getFundSource(id)
    const newBalance = (fs.current_balance || 0) + amount
    let result: ApiFundSource
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiFundSource>(id, { current_balance: newBalance })
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update({ current_balance: newBalance }).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiFundSource
    }
    createFinanceAuditLog('update', COLLECTION, id, details, amount)
    createActivity('update', COLLECTION, id, `Restored fund source balance: ₱${amount} — ${details}`)
    return result
  } catch (e) { throw handleApiError(e) }
}

export async function updateFundSource(id: string, data: Partial<FundSourceData>): Promise<ApiFundSource> {
  try {
    let result: ApiFundSource
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiFundSource>(id, data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(data).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiFundSource
    }
    createFinanceAuditLog('update', COLLECTION, result.id, `updated fund_sources: ${result.name}`)
    createActivity('update', COLLECTION, id, `Updated fund source: ${result.name}`)
    return result
  } catch (e) { throw handleApiError(e) }
}

export async function deleteFundSource(id: string): Promise<boolean> {
  try {
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createFinanceAuditLog('delete', COLLECTION, id, `deleted fund_sources`)
    createActivity('delete', COLLECTION, id, 'Deleted fund source')
    return true
  } catch (e) { throw handleApiError(e) }
}
