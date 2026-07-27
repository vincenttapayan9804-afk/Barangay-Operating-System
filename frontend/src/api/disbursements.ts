import { getClient } from './client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { handleApiError } from './errorHandler'
import type { ApiAppropriation } from './appropriations'
import { getAppropriation } from './appropriations'
import { deductFundSourceBalance, restoreFundSourceBalance } from './fundSources'
import { getCurrentUser } from '@/auth/session'
import { createFinanceAuditLog } from './financeAudit'
import { createActivity } from './activity'
import type { BaseRecord } from './types'

const COLLECTION = 'disbursements'

export interface DisbursementData {
  appropriation?: string
  payee?: string
  disbursement_date?: string
  amount?: number
  check_no?: string
  or_no?: string
  particular?: string
  notes?: string
}

export interface ApiDisbursement extends BaseRecord {
  appropriation: string
  payee: string
  disbursement_date: string
  amount: number
  check_no: string
  or_no: string
  particular: string
  notes: string
  created_by?: string
  expand?: { appropriation?: ApiAppropriation }
}

function withExpand(row: Record<string, unknown>): ApiDisbursement {
  const { _appropriation_expand, ...rest } = row as { _appropriation_expand?: ApiAppropriation }
  return { ...rest, expand: _appropriation_expand ? { appropriation: _appropriation_expand } : undefined } as ApiDisbursement
}

export async function getDisbursements(startDate?: string, endDate?: string): Promise<ApiDisbursement[]> {
  try {
    if (isDemoModeEnabled()) {
      const filters: string[] = []
      if (startDate) filters.push(getClient().filter('disbursement_date >= {:d}', { d: startDate }))
      if (endDate) filters.push(getClient().filter('disbursement_date <= {:d}', { d: endDate }))
      const filter = filters.join(' && ')
      return await getClient().collection(COLLECTION).getFullList<ApiDisbursement>({ filter, sort: '-disbursement_date', expand: 'appropriation' })
    }
    let q = getSupabase().from(COLLECTION).select('*, _appropriation_expand:appropriations(*)')
    if (startDate) q = q.gte('disbursement_date', startDate)
    if (endDate) q = q.lte('disbursement_date', endDate)
    const { data, error } = await q.order('disbursement_date', { ascending: false })
    if (error) throw error
    return (data as Record<string, unknown>[]).map(withExpand)
  } catch (e) { throw handleApiError(e) }
}

export async function getDisbursement(id: string): Promise<ApiDisbursement> {
  try {
    if (isDemoModeEnabled()) {
      return await getClient().collection(COLLECTION).getOne<ApiDisbursement>(id, { expand: 'appropriation' })
    }
    const { data, error } = await getSupabase().from(COLLECTION).select('*, _appropriation_expand:appropriations(*)').eq('id', id).single()
    if (error) throw error
    return withExpand(data as Record<string, unknown>)
  }
  catch (e) { throw handleApiError(e) }
}

export async function createDisbursement(data: DisbursementData): Promise<ApiDisbursement> {
  try {
    const payload = { ...data, created_by: getCurrentUser()?.id }
    let result: ApiDisbursement
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).create<ApiDisbursement>(payload)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).insert(payload).select().single()
      if (error) throw error
      result = row as ApiDisbursement
    }
    createFinanceAuditLog('create', COLLECTION, result.id, `created disbursements: ${data.particular || ''}`, data.amount)
    createActivity('create', COLLECTION, result.id, `Created disbursement: ${data.particular || ''} — ₱${data.amount}`)
    if (data.appropriation && data.amount && data.amount > 0) {
      try {
        const appr = await getAppropriation(data.appropriation)
        if (appr.fund_source) {
          await deductFundSourceBalance(appr.fund_source, data.amount, `disbursement: ${data.particular || appr.item_name}`)
        }
      } catch {}
    }
    return result
  }
  catch (e) { throw handleApiError(e) }
}

export async function updateDisbursement(id: string, data: Partial<DisbursementData>): Promise<ApiDisbursement> {
  try {
    let result: ApiDisbursement
    if (isDemoModeEnabled()) {
      result = await getClient().collection(COLLECTION).update<ApiDisbursement>(id, data)
    } else {
      const { data: row, error } = await getSupabase().from(COLLECTION).update(data).eq('id', id).select().single()
      if (error) throw error
      result = row as ApiDisbursement
    }
    createFinanceAuditLog('update', COLLECTION, result.id, `updated disbursements`, result.amount)
    createActivity('update', COLLECTION, id, `Updated disbursement: ₱${result.amount}`)
    return result
  }
  catch (e) { throw handleApiError(e) }
}

export async function deleteDisbursement(id: string): Promise<boolean> {
  try {
    const existing = await getDisbursement(id)
    if (isDemoModeEnabled()) {
      await getClient().collection(COLLECTION).delete(id)
    } else {
      const { error } = await getSupabase().from(COLLECTION).delete().eq('id', id)
      if (error) throw error
    }
    createFinanceAuditLog('delete', COLLECTION, id, `deleted disbursements`)
    createActivity('delete', COLLECTION, id, 'Deleted disbursement')
    if (existing.appropriation && existing.amount > 0) {
      try {
        const appr = await getAppropriation(existing.appropriation)
        if (appr.fund_source) {
          await restoreFundSourceBalance(appr.fund_source, existing.amount, `disbursement deleted: ${existing.particular || appr.item_name}`)
        }
      } catch {}
    }
    return true
  }
  catch (e) { throw handleApiError(e) }
}
